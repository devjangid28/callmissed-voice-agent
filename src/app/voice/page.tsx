"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Mic, MicOff, PhoneOff, Sparkles } from "lucide-react"
import { toast } from "sonner"
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type TranscriptionSegment,
} from "livekit-client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Status = "idle" | "connecting" | "in-call" | "ended"

type Segment = {
  id: string
  text: string
  final: boolean
  order: number
}

const STATUS_COPY: Record<Status, { label: string; hint: string }> = {
  idle: {
    label: "Ready",
    hint: "Start a call to talk with the voice agent.",
  },
  connecting: { label: "Connecting…", hint: "Negotiating a secure audio stream." },
  "in-call": { label: "In call", hint: "Speak normally — the agent will respond." },
  ended: { label: "Call ended", hint: "Start again whenever you like." },
}

export default function VoicePage() {
  const [status, setStatus] = useState<Status>("idle")
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a friendly, concise voice assistant."
  )
  const [segments, setSegments] = useState<Segment[]>([])
  const [micEnabled, setMicEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const roomRef = useRef<Room | null>(null)
  const segmentsRef = useRef<Map<string, Segment>>(new Map())
  const counterRef = useRef(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const meterRef = useRef<HTMLDivElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const cleanupAudio = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    void audioCtxRef.current?.close().catch(() => undefined)
    audioCtxRef.current = null
    if (meterRef.current) meterRef.current.style.height = "0%"
  }, [])

  const disconnect = useCallback(async () => {
    cleanupAudio()
    const room = roomRef.current
    roomRef.current = null
    if (room) {
      room.removeAllListeners()
      await room.disconnect().catch(() => undefined)
    }
  }, [cleanupAudio])

  useEffect(() => {
    return () => {
      void disconnect()
    }
  }, [disconnect])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [segments])

  /** Drives the mic level bar straight from the DOM to avoid re-renders. */
  const startMeter = useCallback(
    (room: Room) => {
      const publication = room.localParticipant.getTrackPublication(
        Track.Source.Microphone
      )
      const mediaTrack = publication?.track?.mediaStreamTrack
      if (!mediaTrack || typeof AudioContext === "undefined") return

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

      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteTimeDomainData(data)

        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const normalized = (data[i] - 128) / 128
          sum += normalized * normalized
        }
        const rms = Math.sqrt(sum / data.length)
        const percent = Math.min(100, Math.round(rms * 320))

        if (meterRef.current) {
          meterRef.current.style.height = `${percent}%`
        }

        rafRef.current = requestAnimationFrame(tick)
      }

      tick()
    },
    []
  )

  const start = async () => {
    if (status === "connecting" || status === "in-call") return

    setStatus("connecting")
    segmentsRef.current = new Map()
    setSegments([])

    try {
      const res = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_prompt: systemPrompt.trim() || undefined }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error?.message || `Request failed (${res.status})`)
      }
      if (!data?.ws_url || !data?.token) {
        throw new Error("Session response did not include ws_url and token")
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      room.on(
        RoomEvent.TranscriptionReceived,
        (_segments: TranscriptionSegment[]) => {
          setSegments((prev) => {
            const next = [...prev]
            for (const segment of _segments) {
              const existing = segmentsRef.current.get(segment.id)
              const entry: Segment = {
                id: segment.id,
                text: segment.text,
                final: segment.final,
                order: existing?.order ?? counterRef.current++,
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
        setIsSpeaking(speakers.some((p) => !p.isLocal))
      })

      room.on(RoomEvent.MediaDevicesError, (error) => {
        toast.error("Microphone unavailable", { description: error.message })
      })

      room.on(RoomEvent.Disconnected, () => {
        cleanupAudio()
        setStatus("ended")
      })

      await room.connect(data.ws_url, data.token)

      // Unlock audio playback from within the user gesture.
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
      const message = error instanceof Error ? error.message : "Unknown error"
      toast.error("Could not start the voice call", { description: message })
    }
  }

  const end = async () => {
    await disconnect()
    setMicEnabled(false)
    setIsSpeaking(false)
    setStatus("ended")
    toast.info("Call ended")
  }

  const toggleMic = async () => {
    const room = roomRef.current
    if (!room) return

    const next = !micEnabled
    try {
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicEnabled(next)
      toast.info(next ? "Microphone on" : "Microphone muted")
    } catch (error) {
      toast.error("Could not change microphone state", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const connectionLabel =
    roomRef.current?.state === ConnectionState.Connected ? "Connected" : ""

  const copy = STATUS_COPY[status]

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center gap-6 p-6 sm:p-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <span
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-full border transition-all duration-300",
                status === "in-call"
                  ? isSpeaking
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-500"
                    : "border-border bg-muted/40 text-muted-foreground"
                  : "border-border bg-muted/40"
              )}
            >
              {status === "in-call" ? (
                <Mic className="h-8 w-8" />
              ) : (
                <MicOff className="h-8 w-8 text-muted-foreground" />
              )}
            </span>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{copy.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.hint}</p>
            </div>
          </div>

          {status === "in-call" && (
            <div className="flex h-24 w-full max-w-xs items-end justify-center gap-1">
              <div
                ref={meterRef}
                className="w-3 rounded-full bg-emerald-500/80 transition-[height] duration-75"
                style={{ height: "0%" }}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {status === "in-call" ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => void toggleMic()}
                  className="h-11 rounded-xl"
                >
                  {micEnabled ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Mute
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Unmute
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => void end()}
                  className="h-11 rounded-xl"
                >
                  <PhoneOff className="h-4 w-4" />
                  End call
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                onClick={() => void start()}
                disabled={status === "connecting"}
                className="h-11 rounded-xl px-6"
              >
                {status === "connecting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Start Voice Call
                  </>
                )}
              </Button>
            )}
          </div>

          {status !== "in-call" && (
            <div className="grid w-full max-w-md gap-1.5">
              <label
                htmlFor="voice-prompt"
                className="text-sm font-medium text-muted-foreground"
              >
                System prompt
              </label>
              <Textarea
                id="voice-prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[64px] resize-none"
                placeholder="How should the agent behave?"
              />
            </div>
          )}

          {connectionLabel && (
            <p className="text-xs text-muted-foreground">{connectionLabel}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">
              Live transcript
            </h3>
            {segments.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {segments.length} segment{segments.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="h-56 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
            {segments.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Live transcript will appear here…
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {segments.map((segment) => (
                  <p
                    key={segment.id}
                    className={cn(
                      "whitespace-pre-wrap break-words transition-opacity",
                      segment.final ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {segment.text}
                  </p>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}