# Meet-V3 Technical Specification

## 🚀 Project Overview
Meet-V3 is a high-performance, real-time video conferencing application built with a focus on low-latency communication, responsive design, and robust session management. It supports both authenticated users and guests, providing a seamless "click-to-join" experience.

---

## 🛠️ Core Technology Stack

### Frontend
- **Framework**: React 18+ with TypeScript
- **State Management**: React Context API & Hooks (Custom `useWebRTC`)
- **Real-time Signaling**: Socket.io-client
- **Media**: WebRTC (RTCPeerConnection API)
- **Styling**: Vanilla CSS / Tailwind CSS (Optional)
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Database**: PostgreSQL (via Prisma ORM)
- **Real-time Server**: Socket.io
- **Security**: Arcjet (Rate limiting & Bot protection)
- **Logging**: Custom Winston-based logger

---

## 📡 Essential Systems & Architectures

### 1. WebRTC Signaling Flow
The application uses a "Mesh" architecture where every participant connects directly to every other participant.
- **Connection Handshake**: Participants exchange SDP (Session Description Protocol) offers/answers and ICE (Interactive Connectivity Establishment) candidates via the Socket.io server.
- **Glare Resolution**: Implements a "sync-peers" pattern to prevent race conditions where two users attempt to call each other simultaneously.
- **Dynamic Stream Management**: Automatically handles track additions/removals and ensures React re-renders by tracking `MediaStream` instances.

### 2. Socket Room Management
- **Universal IDs**: Supports both numeric Database IDs and string-based "Nanoids" (e.g., `xxx-xxx-xxx`).
- **Polymorphic Auth**: Handles both registered `userId` and `guestId` in the same room state.
- **Media State Persistence**: The server tracks the camera/mic status of every participant so that new joiners immediately see the correct state of the room.

### 3. Connection Resilience (Soft Reconnect)
- **30s Grace Period**: If a user disconnects due to network jitter, the server preserves their state for 30 seconds.
- **Silent Recovery**: If the user re-links within the window, their PeerConnections are restored without them needing to manually rejoin.
- **State Normalization**: Ensures string-based guest identifiers are fully supported during the recovery window.

### 4. Video Grid Engine
- **CSS Grid/Flexbox**: A responsive layout that dynamically scales participant cards from 1 up to many users.
- **Aspect Ratio Locking**: Ensures video tiles maintain a 16:9 or 4:3 ratio without collapsing.
- **Avatar Fallback**: Automatically renders a colored avatar with user initials if the video track is disabled or the stream is pending.

---

## 🔒 Security & Performance
- **NAT Traversal**: Configured with multiple Google STUN servers to ensure 95%+ success rate in establishing P2P connections behind firewalls.
- **Prisma Middlewares**: Automated cleanup of participant records in the database when meetings end.
- **Arcjet Protection**: Shielded against DDoS and rapid-join bot attacks on meeting endpoints.

---

## 📂 Project Structure
```text
/
├── server/                 # Node.js Signaling & API Server
│   ├── sockets/            # Socket.io handlers (Room, Signaling, Chat)
│   ├── state/              # In-memory session tracking
│   ├── services/           # Business logic (Room management)
│   └── lifecycle/          # Connection recovery logic
├── src/                    # React Frontend
│   ├── services/           # WebRTC Service & Socket client
│   ├── components/         # UI Components (VideoCard, VideoGrid)
│   ├── context/            # Global WebRTC State Provider
│   └── hooks/              # Custom React Hooks
└── prisma/                 # Database Schema & Migrations
```
