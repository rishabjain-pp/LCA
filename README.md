# LCA Relay Server

LCA Relay Server: A TypeScript relay that bridges Twilio Media Streams to AWS Live Call Analytics (LCA) for real-time call transcription and sentiment analysis.

## How It Works

A phone call arrives at a Twilio number. Twilio opens a Media Streams WebSocket to this relay server. The relay server forwards audio over a second WebSocket connection to the AWS LCA AudioHook endpoint. AWS LCA transcribes and analyzes the call in real time, surfacing results on the LCA dashboard.

```
Phone Call -> Twilio -> Media Streams WS -> [This Server] -> AudioHook WS -> AWS LCA -> Dashboard
```

## Prerequisites

- Node.js 20+
- [ngrok](https://ngrok.com/) (for local development)
- Twilio account with an active phone number
- AWS account with the LCA CloudFormation stack deployed

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. Start the development server with hot reload:
   ```bash
   npm run dev
   ```

## ngrok Setup

Expose your local server to the internet so Twilio can reach it:

```bash
ngrok http 8080
```

Copy the HTTPS forwarding URL (e.g., `https://<ngrok-id>.ngrok.io`). You will need it for the Twilio webhook and for the `WS_URL` environment variable.

## Twilio Configuration

1. Open the [Twilio Console](https://console.twilio.com/).
2. Navigate to your phone number's configuration page.
3. Under **Voice & Fax**, set the webhook for incoming calls to:
   ```
   POST https://<ngrok-id>.ngrok.io/twiml
   ```
4. Save the configuration.

## Testing

```bash
npm test
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | HTTP/WebSocket server port (default: `8080`) |
| `WS_URL` | Public WebSocket URL Twilio connects to (e.g., `wss://<ngrok-id>.ngrok.io/ws`) |
| `LCA_ENDPOINT` | LCA AudioHook WebSocket endpoint from CloudFormation Outputs |
| `LCA_ORG_ID` | Organization ID for the AudioHook protocol (UUID format) |
| `LCA_API_KEY` | Optional API key for LCA authentication |
| `AWS_REGION` | AWS region (used for SigV4 auth in Phase 3, default: `us-east-1`) |

## Architecture

```
Phone Call -> Twilio -> Media Streams WS -> [This Server] -> AudioHook WS -> AWS LCA -> Dashboard
```

Key components:

- `src/index.ts` — Express server, WebSocket upgrade routing, TwiML endpoint
- `src/twilioHandler.ts` — Parses Twilio Media Streams messages, manages call sessions
- `src/lcaClient.ts` — Manages the outbound WebSocket connection to AWS LCA AudioHook
- `src/types/` — TypeScript interfaces for the Twilio and AudioHook protocols

## Audio Pipeline

Twilio encodes audio as Base64 μ-law (G.711 ulaw) at 8 kHz. The relay decodes each Base64 payload to a raw `Buffer` and forwards it as a binary WebSocket frame to the LCA AudioHook endpoint without re-encoding.

```
Twilio WS frame (JSON, Base64 ulaw 8kHz)
  -> decode Base64 -> raw Buffer
  -> LCA AudioHook WS frame (binary)
```

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 1 | DONE | TypeScript boilerplate + relay server |
| Phase 2 | Planned | Live demo integration with real LCA stack |
| Phase 3 | Planned | Production hardening (SigV4 auth, Docker, structured logging) |
