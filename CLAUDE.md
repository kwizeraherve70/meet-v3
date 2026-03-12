# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Development (starts both frontend on :5173 and backend on :3001 concurrently)
npm run dev

# Frontend only
npm run client

# Backend only (with nodemon auto-reload)
npm run server:dev

# Production build (compiles server TS + Vite build)
npm run build

# Lint
npm run lint

# Database migrations
npx prisma migrate dev        # development
npm run prisma:migrate        # deploy (production)

# Seed database
npm run db:seed

# Prisma Studio (GUI)
npx prisma studio
```

There are no automated tests — testing is manual.

## Environment Setup

Copy `.env.example` to `.env`. Required variables:

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
SERVER_PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

Optional (for production features):
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — distributed caching (Upstash Redis)
- Arcjet API key — rate limiting for chat messages

## Architecture Overview

This is a **full-stack TypeScript monorepo** with a separate Express/Socket.IO backend (`server/`) and a Vite/React frontend (`src/`). Both share the same `package.json`.

### Backend (`server/`)

**Entry point**: `server/server.ts` → `server/app.ts` (Express) + `server/sockets/index.ts` (Socket.IO)

Key layers:
- **`server/config/`** — Environment, Socket.IO CORS, ICE servers, Upstash Redis, Arcjet
- **`server/middleware/`** — JWT auth (`auth.middleware.ts`), socket auth (`socket.auth.ts`), room access validation (`room.access.ts`)
- **`server/routes/`** — REST API: `/auth` (login/register/refresh) and `/api/rooms` (CRUD)
- **`server/sockets/`** — Socket.IO handlers: `room.socket.ts` (room/chat/media/emoji events), `signaling.socket.ts` (WebRTC offer/answer/ICE)
- **`server/state/socket.state.ts`** — In-memory maps tracking live socket connections, user→socket and room→socket mappings. This is the source of truth for who is in which room.
- **`server/lifecycle/soft.reconnect.ts`** — 30-second grace period reconnection. When a user disconnects, they are NOT immediately removed from the room — they enter a pending state that allows seamless rejoin.
- **`server/services/`** — `RoomService` (DB room ops + chat history), `UserService` (JWT issue/verify, password hashing)
- **`server/lib/emoji-rate-limiter.ts`** — In-memory rate limiter (3 emojis per 10 seconds per user per room)

**TypeScript config for server**: `tsconfig.server.json` — compiles to `dist/server/` with ESM (`"module": "NodeNext"`).

### Frontend (`src/`)

**Entry**: `src/main.tsx` → `src/App.tsx`

Provider stack (outermost first): `ErrorBoundary` → `QueryClientProvider` → `ToastProvider` → `AuthProvider` → `TooltipProvider` → `BrowserRouter`

Routes:
- `/login` — `LoginPage` (public)
- `/` — `Dashboard` (protected)
- `/schedule` — `SchedulePage` (protected)
- `/join`, `/join/:roomId`, `/:roomId` — `PreJoinScreen` (public, pre-join lobby)
- `/meeting/:roomId` — `MeetingPage` (public, active meeting)

Key frontend modules:
- **`src/lib/socket.ts`** — Singleton `SocketService` wrapping Socket.IO client. Requires a JWT auth token or guest token before connecting (no anonymous connections). Token is read from `apiClient`, then `localStorage.authToken`, then `localStorage.guestToken`.
- **`src/services/webrtcService.ts`** — Singleton `WebRTCService` managing `RTCPeerConnection` per remote peer, ICE candidate queuing, screen share switching. Uses **mesh networking** (each peer connects directly to every other peer).
- **`src/context/AuthContext.tsx`** — Auth state (access token, user info, login/logout). Tokens stored in `localStorage`.
- **`src/hooks/useWebRTC.ts`** — Composes socket and WebRTC service; manages joining rooms, handling media state, and listening to all room socket events.

### WebRTC / Signaling Flow

1. Client joins `PreJoinScreen`, gets camera/mic permissions, then navigates to `/meeting/:roomId`.
2. On mount, `MeetingPage` calls `useWebRTC` which:
   - Connects `SocketService` (with token)
   - Emits `join-room` with `roomId` and initial `mediaState`
3. Server responds with `room-joined` (current participants) and broadcasts `user-joined` to others.
4. If existing peers are present, server sends `sync-peers` to the new joiner — they initiate WebRTC `offer` to each existing peer.
5. Signaling (`offer` / `answer` / `icecandidate`) is relayed through `server/sockets/signaling.socket.ts`.
6. After ICE negotiation, direct P2P streams flow client-to-client.

### Socket Event Contract

All event names are defined in `server/contracts/socket.events.ts` as `ClientEvents` (client→server) and `ServerEvents` (server→client). When adding new events, update this file and the `SocketEvents` interface in `src/lib/socket.ts`.

### Database Schema (Prisma / PostgreSQL)

Models: `User`, `Room` (has `roomCode`, `isActive`), `Participant` (supports guests via `guestName`), `Message` (supports guests), `RefreshToken`, `Recording`.

Guest support: Both `Participant` and `Message` have nullable `userId` and `guestName` fields. Guest tokens are JWT-signed by the server with a `guestId` UUID.

### Host Controls

`isHost` is set **server-side** during `join-room` (by comparing `userId` against `Room.createdById`). Clients cannot self-promote. The host can:
- Mute individual participants (`host-mute-participant`)
- Disable individual video (`host-disable-video`)
- Mute all participants (`host-mute-all`)
- All enforced server-side via `SocketState.isHost` check

When the host leaves, the server automatically promotes the first remaining participant.

### UI Components

`src/components/ui/` contains shadcn/ui components (configured via `components.json`). Add new shadcn components with `npx shadcn-ui@latest add <component>`. Do not manually edit files in `src/components/ui/` unless fixing bugs.

### Path Aliases

`@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`). Use `@/` for all frontend imports.
