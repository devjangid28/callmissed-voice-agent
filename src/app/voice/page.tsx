"use client"

import * as React from "react"
import {
  Info,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RotateCw,
} from "lucide-react"
import { toast } from "sonner"
import {
  Room,
  RoomEvent,
  Track,
  type TranscriptionSegment,
} from "livekit-client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Status = "idle" | "connecting" | "in-call" | "ended"

type Segment = {
  id: string
  text: string
  final: boolean
  order: number
}

const STATUS_COPY: Record<Status, { label: string; hint: string; tone: string }> = {
  idle: {
    label: "Ready",
    hint: "Start a call to talk to the voice agent.",
    tone: "text-muted-foreground",
  },
  connecting: {
    label: "Connecting…",
    hint: "Negotiating a secure audio stream.",
    tone: "text-warning",
  },
  "in-call": {
    label: "In call",
    hint: "Speak normally — the agent will reply.",
    tone: "text-success",
  },
  ended: {
    label: "Ended",
    hint: "Start again whenever you like.",
    tone: "text-muted-foreground",
  },
}

const PIPELINE = ["STT", "LLM", "TTS"] as const

export default function VoicePage() {
  const [status, setStatus] = React.useState<Status>("idle")
  const [systemPrompt, setSystemPrompt] = React.useState(
    "You are a friendly, concise voice assistant."
  )
  const [segments, setSegments] = React.useState<Segment[]>([])
  const [micEnabled, setMicEnabled] = React.useState(true)
  const [agentSpeaking, setAgentSpeaking] = React.useState(false)

  const roomRef = React.useRef<Room | null>(null)
  const segmentsRef = React.useRef<Map<string, Segment>>(new Map())
  const orderRef = React.useRef(0)
  const audioCtxRef = React.useRef<AudioContext | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const orbRef = React.useRef<HTMLDivElement>(null)
  const endRef = React.useRef<HTMLDivElement>(null)

  const cleanupAudio = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    void audioCtxRef.current?.close().catch(() => undefined)
    audioCtxRef.current = null
    if (orbRef.current) {
      orbRef.current.style.transform = "scale(1)"
      orbRef.current.style.opacity = "0"
    }
  }, [])

  const disconnect = React.useCallback(async () => {
    cleanupAudio()
    const room = roomRef.current
    roomRef.current = null
    if (room) {
      room.removeAllListeners()
      await room.disconnect().catch(() => undefined)
    }
  }, [cleanupAudio])

  React.useEffect(() => () => void disconnect(), [disconnect])

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [segments])

  /**
   * Drives the orb straight from the DOM, avoiding a React render per frame.
   * The scale is written inline and CSS transitions it, which smooths the
   * raw 60fps RMS values into a gentle pulse.
   */
  const startMeter = React.useCallback((room: Room) => {
    const publication = room.localParticipant.getTrackPublication(
      Track.Source.Microphone
    )
    const mediaTrack = publication?.track?.mediaStreamTrack
    if (!mediaTrack || typeof window === "undefined") return

    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioCtor) return

    const ctx = new AudioCtor()
    audioCtxRef.current = ctx

    const source = ctx.createMediaStreamSource(new MediaStream([mediaTrack]))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)

    const samples = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteTimeDomainData(samples)

      let sum = 0
      for (let i = 0; i < samples.length; i++) {
        const n = (samples[i] - 128) / 128
        sum += n * n
      }
      const rms = Math.sqrt(sum / samples.length)

      const orb = orbRef.current
      if (orb) {
        orb.style.transform = `scale(${(1 + Math.min(rms * 2.4, 0.32)).toFixed(3)})`
        orb.style.opacity = String(Math.min(0.35 + rms * 3.5, 0.85))
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    tick()
  }, [])

  const start = React.useCallback(async () => {
    if (status === "connecting" || status === "in-call") return

    setStatus("connecting")
    segmentsRef.current = new Map()
    orderRef.current = 0
    setSegments([])

    try {
      const response = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(
          data?.error?.message || `Request failed (${response.status})`
        )
      }
      if (!data?.ws_url || !data?.token) {
        throw new Error("Session response did not include ws_url and token")
      }

      const room = new Room({ adaptiveStream: true, dynacast: true })

      // livekit-client 2.x emits TranscriptionReceived (not TranscriptionUpdate).
      room.on(
        RoomEvent.TranscriptionReceived,
        (incoming: TranscriptionSegment[]) => {
          setSegments((prev) => {
            const next = [...prev]
            for (const segment of incoming) {
              const existing = segmentsRef.current.get(segment.id)
              const entry: Segment = {
                id: segment.id,
                text: segment.text,
                final: segment.final,
                order: existing?.order ?? orderRef.current++,
              }
              segmentsRef.current.set(segment.id, entry)

              const index = next.findIndex((s) => s.id === segment.id)
              if (index >= 0) next[index] = entry
              else next.push(entry)
            }
            return next.sort((a, b) => a.order - b.order)
          })
        }
      )

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setAgentSpeaking(speakers.some((participant) => !participant.isLocal))
      })

      room.on(RoomEvent.MediaDevicesError, (error) => {
        toast.error("Microphone unavailable", { description: error.message })
      })

      room.on(RoomEvent.Disconnected, () => {
        cleanupAudio()
        setStatus("ended")
      })

      await room.connect(data.ws_url, data.token)
      // Unlocks playback from inside the click gesture.
      await room.startAudio().catch(() => undefined)
      await room.localParticipant.setMicrophoneEnabled(true)

      roomRef.current = room
      setMicEnabled(true)
      startMeter(room)
      setStatus("in-call")
      toast.success("Voice call started")
    } catch (error) {
      await disconnect()
      setStatus("ended")
      toast.error("Could not start the voice call", {
        description:
          error instanceof Error ? error.message : "Unknown error",
        action: { label: "Try again", onClick: () => void start() },
      })
    }
  }, [cleanupAudio, disconnect, startMeter, status, systemPrompt])

  const end = React.useCallback(async () => {
    await disconnect()
    setMicEnabled(false)
    setAgentSpeaking(false)
    setStatus("ended")
    toast.info("Call ended")
  }, [disconnect])

  const toggleMic = React.useCallback(async () => {
    const room = roomRef.current
    if (!room) return

    const next = !micEnabled
    try {
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicEnabled(next)
    } catch (error) {
      toast.error("Could not change microphone state", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [micEnabled])

  const copy = STATUS_COPY[status]
  const inCall = status === "in-call"
  const busy = status === "connecting"

  return (
    <div className="container-page py-8 sm:py-12">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          Voice
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Full-duplex audio over WebRTC, with a live transcript of both sides of
          the conversation.
        </p>
      </header>

      {/* Center stage */}
      <div className="mt-10 flex flex-col items-center">
        <div className="relative flex h-48 w-48 items-center justify-center sm:h-64 sm:w-64">
          {/* Idle: a slow breathing halo. In call: the mic-driven orb. */}
          {!inCall && !busy && (
            <>
              <span
                aria-hidden
                className="absolute inset-6 rounded-full border border-primary/30 animate-pulse-ring"
              />
              <span
                aria-hidden
                className="absolute inset-10 rounded-full border border-primary/20 animate-pulse-ring [animation-delay:900ms]"
              />
            </>
          )}

          <div
            ref={orbRef}
            aria-hidden
            className="absolute inset-16 rounded-full bg-primary/30 blur-xl transition-[transform,opacity] duration-100 ease-out"
            style={{ transform: "scale(1)", opacity: "0" }}
          />

          <button
            type="button"
            onClick={() => void start()}
            disabled={inCall || busy}
            aria-label={
              busy ? "Connecting" : inCall ? "Call in progress" : "Start voice call"
            }
            className={cn(
              "relative flex h-24 w-24 items-center justify-center rounded-full sm:h-32 sm:w-32",
              "text-primary-foreground shadow-lift",
              "transition-[transform,background-color,box-shadow] duration-200 ease-out-expo",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
              inCall || busy
                ? "cursor-default bg-card text-card-foreground ring-1 ring-border"
                : "bg-primary hover:-translate-y-0.5 hover:shadow-glow active:translate-y-0"
            )}
          >
            {busy ? (
              <Loader2 aria-hidden className="h-6 w-6 animate-spin text-muted-foreground sm:h-7 sm:w-7" />
            ) : inCall ? (
              <Mic
                aria-hidden
                className={cn(
                  "h-6 w-6 transition-colors duration-300 sm:h-7 sm:w-7",
                  agentSpeaking ? "text-success" : "text-muted-foreground"
                )}
              />
            ) : (
              <Mic aria-hidden className="h-6 w-6 sm:h-7 sm:w-7" />
            )}
          </button>
        </div>

        {/* Status bar */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-current",
              copy.tone
            )}
            aria-hidden
          />
          <p className={cn("font-medium", copy.tone)}>{copy.label}</p>
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <p className="text-muted-foreground">{copy.hint}</p>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {inCall ? (
            <>
              <Button
                variant="outline"
                onClick={() => void toggleMic()}
                aria-pressed={!micEnabled}
              >
                {micEnabled ? (
                  <MicOff aria-hidden className="h-4 w-4" />
                ) : (
                  <Mic aria-hidden className="h-4 w-4" />
                )}
                {micEnabled ? "Mute" : "Unmute"}
              </Button>

              <Button variant="destructive" onClick={() => void end()}>
                <PhoneOff aria-hidden className="h-4 w-4" />
                End call
              </Button>
            </>
          ) : (
            <Button
              onClick={() => void start()}
              disabled={busy}
              size="lg"
              className="rounded-2xl"
            >
              {busy ? (
                <>
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                  Connecting
                </>
              ) : (
                <>
                  <Mic aria-hidden className="h-4 w-4" />
                  Start voice call
                </>
              )}
            </Button>
          )}

          <Tooltip
            content={
              <span>
                Audio runs over WebRTC: your speech is transcribed (STT), sent to
                the model (LLM), and the reply is spoken back (TTS). Nothing is
                recorded.
              </span>
            }
          >
            <button
              type="button"
              aria-label="How voice works"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/60 text-muted-foreground",
                "transition-colors duration-200 ease-out-expo hover:bg-accent hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <Info aria-hidden className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>

        {/* Pipeline chips */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {PIPELINE.map((stage, index) => (
            <React.Fragment key={stage}>
              {index > 0 && (
                <span aria-hidden className="text-muted-foreground/40">
                  →
                </span>
              )}
              <span
                className={cn(
                  "rounded-lg border px-2 py-1 font-mono text-[11px] font-medium",
                  inCall
                    ? "border-primary/30 bg-accent text-accent-foreground"
                    : "border-border/60 text-muted-foreground"
                )}
              >
                {stage}
              </span>
            </React.Fragment>
          ))}
          <span className="text-[11px] text-muted-foreground">
            over WebRTC
          </span>
        </div>

        {/* Agent instructions */}
        {!inCall && !busy && (
          <div className="mt-6 w-full max-w-md sm:mt-8">
            <label
              htmlFor="voice-prompt"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Agent instructions
            </label>
            <Textarea
              id="voice-prompt"
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="How should the agent behave?"
              className="min-h-[72px] resize-none"
            />
          </div>
        )}
      </div>

      {/* Transcript */}
      <section
        aria-label="Live transcript"
        className="mt-8 rounded-2xl border border-border/60 bg-card/40 shadow-soft sm:mt-12"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5 sm:py-3.5">
          <h2 className="text-sm font-medium tracking-tight">Transcript</h2>
          {segments.length > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {segments.length}
            </span>
          )}
        </div>

        <div
          className="scroll-slim h-64 overflow-y-auto p-4 sm:p-5"
          role="log"
          aria-live="polite"
        >
          {segments.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Live transcript will appear here…
            </p>
          ) : (
            <div className="space-y-2.5">
              {segments.map((segment) => (
                <p
                  key={segment.id}
                  className={cn(
                    "text-sm leading-relaxed transition-opacity duration-200 ease-out-expo",
                    segment.final
                      ? "text-foreground"
                      : "text-muted-foreground/70"
                  )}
                >
                  {segment.text}
                </p>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {status === "ended" && (
          <div className="flex items-center justify-center gap-3 border-t border-border/60 px-4 py-3 sm:px-5 sm:py-3.5">
            <p className="text-xs text-muted-foreground">
              This call has ended.
            </p>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void start()}
              className="text-xs"
            >
              <RotateCw aria-hidden className="h-3.5 w-3.5" />
              Start again
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
