# Voice Agent Platform

A production-ready, minimal, and aesthetic web app for a voice agent platform that lets users chat with an AI, generate images, and talk to a real-time voice agent. Built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui, powered by the CallMissed API.

## Features

- **Chat with AI**: Streaming completions with support for tool calling and JSON mode
- **Image Generation**: Generate up to 4 images with customizable parameters (negative prompts, seeds, steps, size)
- **Real-time Voice Agent**: WebRTC-based voice calls with STT ? LLM ? TTS pipeline
- **Dark mode by default** with light mode toggle
- **Mobile-first responsive design**
- **Fully server-side API proxying** - No secrets exposed to the browser

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: TanStack Query + Zustand
- **Voice**: LiveKit Client for WebRTC
- **Backend**: Next.js API Routes

## Prerequisites

- Node.js 18+ 
- pnpm (package manager)

## Getting Started

1. Clone the repository
2. Install dependencies:

`ash
pnpm install
`

3. Copy the environment variables:

`ash
cp .env.example .env.local
`

4. The API key is already configured in .env.local for development. For production, set CALLMISSED_API_KEY in your hosting environment.

5. Run the development server:

`ash
pnpm dev
`

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- pnpm dev - Start development server
- pnpm build - Build for production
- pnpm start - Start production server
- pnpm lint - Run ESLint

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| CALLMISSED_API_KEY | CallMissed API key | Yes |

## API Architecture

All CallMissed API calls are proxied through Next.js API routes to ensure the API key is never exposed to the client:

- POST /api/chat ? Proxies to https://api.callmissed.com/v1/chat/completions (supports streaming)
- POST /api/images ? Proxies to https://api.callmissed.com/v1/images/generations
- POST /api/voice/session ? Proxies to https://api.callmissed.com/v1/voice/sessions
- GET /api/models ? Proxies to models endpoint

## Deployment

### AWS Amplify Hosting (Recommended)

1. Push your code to a Git repository (GitHub, GitLab, etc.)
2. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
3. Connect to your repository
4. Configure build settings (Amplify auto-detects Next.js)
5. Add environment variable: CALLMISSED_API_KEY with the provided key
6. Deploy

### EC2 t2.micro (Alternative)

1. Launch an EC2 t2.micro instance with Ubuntu
2. Install Node.js and pnpm
3. Clone the repository
4. Install dependencies: pnpm install
5. Build: pnpm build
6. Set environment variable: export CALLMISSED_API_KEY=your_key
7. Start with PM2: pm2 start pnpm --name "voice-agent" -- start
8. Configure Nginx as reverse proxy with SSL (optional)
9. Use CloudFront for CDN (optional)

## Testing

All three features have been designed to work end-to-end with the provided CallMissed API key:
- Chat streaming with token-by-token rendering
- Image generation (1-4 images at once)
- Live voice sessions via WebRTC

## License

MIT License

---

Powered by [CallMissed API](https://docs.callmissed.com)
