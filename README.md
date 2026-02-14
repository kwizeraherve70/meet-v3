# WebRTC Video Meeting Application

A modern, real-time video conferencing application built with React, TypeScript, and WebRTC technology.

**Status**: ✅ Phase 3 Complete (90% overall) | 📅 Phase 4 (Testing & Polish) In Progress

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Upstash Redis (for caching)
- Arcjet account (for rate limiting)

### Setup
```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npx prisma migrate dev

# Start backend server
npm run server

# In another terminal, start frontend
npm run dev
```

### Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Socket.IO**: ws://localhost:3001

## Features

### 🎥 Multi-Participant Video Meetings
- Support for multiple participants in a single room
- Real-time video and audio streaming
- Automatic connection management between peers
- Responsive grid layout (1x1, 1x2, 2x2+)

### 🎤 Audio & Video Controls
- Mute/unmute microphone with real-time icon feedback
- Turn camera on/off with avatar display
- Real-time media state synchronization across participants
- Device selection (microphone and camera)
- Audio level indicator with 5-bar visualization
- Pre-join screen with media preview

### 📺 Screen Sharing
- Share your screen with all participants
- Automatic video track switching
- Screen share end detection

### 💬 Real-time Chat
- In-meeting text messaging
- Real-time message delivery via WebSocket
- Message history on join (last 50 messages)
- Optimistic UI (messages appear immediately)
- Send with Enter key (Shift+Enter for new line)

### 👥 Participant Management
- Real-time participant list
- Search participants (if implemented)
- See who's in the meeting
- Live participant count
- User status indicators (audio/video on/off)

### 🔧 Advanced Features
- Connection state monitoring
- Automatic reconnection on network issues
- Error handling with ErrorBoundary
- Toast notifications for user feedback
- Guest support (unauthenticated users)
- Persistent session management

## Technology Stack

### Frontend
- **React 18** with TypeScript for type-safe UI
- **Vite** for fast development and building
- **TailwindCSS** for responsive styling
- **Radix UI** for accessible components
- **React Router** for navigation
- **React Query** for API data management
- **Zustand** for state management (prepared)

### Backend
- **Node.js** with Express for HTTP server
- **Socket.IO 4.x** for real-time WebSocket communication
- **Prisma ORM** for database access
- **PostgreSQL** for data persistence
- **Upstash Redis** for distributed caching
- **Arcjet** for rate limiting and security

### WebRTC Infrastructure
- **STUN servers** (Google public) for NAT traversal
- **Mesh networking** for direct peer connections (P2P)
- **Automatic ICE candidate filtering**
- **SDP offer/answer signaling via Socket.IO**

### Development Tools
- **ESLint** for code quality
- **TypeScript** for type safety
- **Nodemon** for auto-reload during development

## Project Structure

```
meeting-v3/
├── 📁 .github/                        # GitHub workflows and configs
├── 📁 .vscode/                        # VS Code settings
├── 📁 node_modules/                   # Dependencies
│
├── 📁 prisma/                         # Database schema and migrations
│   ├── 📁 migrations/                 # Database migration files
│   ├── schema.prisma                  # Prisma schema definition ✅
│   └── seed.ts                        # Database seeding script ✅
│
├── 📁 server/                         # Backend server code
│   ├── 📁 config/                     # Server configuration
│   │   ├── env.ts                     # Environment variables
│   │   ├── socket.config.ts           # Socket.IO setup
│   │   ├── ice.config.ts              # ICE servers config
│   │   ├── upstash.config.ts          # Redis config
│   │   └── arcjet.config.ts           # Rate limiting config
│   ├── 📁 contracts/                  # API contracts/DTOs
│   ├── 📁 database/                   # Database utilities
│   │   └── prisma.ts                  # Prisma client
│   ├── 📁 lib/                        # Server utilities
│   ├── 📁 lifecycle/                  # Server lifecycle hooks
│   ├── 📁 middleware/                 # Express middleware
│   │   ├── auth.middleware.ts         # Auth protection
│   │   ├── error.middleware.ts        # Error handling
│   │   └── rate-limit.middleware.ts   # Rate limiting
│   ├── 📁 routes/                     # API routes
│   │   ├── auth.routes.ts             # Auth endpoints
│   │   └── rooms.routes.ts            # Room endpoints
│   ├── 📁 services/                   # Business logic services
│   │   ├── room.service.ts            # Room management
│   │   └── user.service.ts            # User management
│   ├── 📁 sockets/                    # WebSocket handlers
│   │   ├── room.socket.ts             # Room events ✅
│   │   ├── signaling.socket.ts        # WebRTC signaling ✅
│   │   ├── socket.helpers.ts          # Helper functions
│   │   └── auth.socket.ts             # Socket authentication
│   ├── 📁 state/                      # Server state management
│   ├── 📁 types/                      # TypeScript type definitions
│   ├── 📁 utils/                      # Utility functions
│   ├── app.ts                         # Express app configuration
│   └── server.ts                      # Server entry point ✅
│
├── 📁 src/                            # Frontend source code
│   ├── 📁 components/                 # React components
│   │   ├── 📁 dashboard/              # Dashboard-specific components
│   │   ├── 📁 layout/                 # Layout components
│   │   ├── 📁 meeting/                # Meeting-specific components
│   │   │   ├── VideoCard.tsx          # Individual video display ✅
│   │   │   ├── VideoGrid.tsx          # Grid layout for videos ✅
│   │   │   ├── ChatSidebar.tsx        # Chat UI ✅
│   │   │   ├── ParticipantsSidebar.tsx # Participant list ✅
│   │   │   ├── ControlBar.tsx         # Media controls ✅
│   │   │   └── MeetingHeader.tsx      # Meeting info header ✅
│   │   ├── 📁 ui/                     # Reusable UI components (49 items)
│   │   ├── DebugInfo.tsx              # Debug information display
│   │   ├── ErrorBoundary.tsx          # Error handling ✅
│   │   ├── NavLink.tsx                # Navigation links
│   │   ├── ProtectedRoute.tsx         # Auth protection ✅
│   │   └── ToastContainer.tsx         # Toast notifications ✅
│   │
│   ├── 📁 context/                    # React Context providers
│   │   ├── AuthContext.tsx            # Authentication context ✅
│   │   ├── ToastContext.tsx           # Toast notifications context ✅
│   │   └── WebRTCContext.tsx          # WebRTC connection context ✅
│   │
│   ├── 📁 hooks/                      # Custom React hooks
│   │   ├── use-mobile.tsx             # Mobile detection hook
│   │   ├── use-toast.ts               # Toast hook
│   │   ├── useAuth.ts                 # Auth logic hook
│   │   └── useWebRTC.ts               # WebRTC logic hook
│   │
│   ├── 📁 lib/                        # Frontend utilities
│   │   ├── api.ts                     # API service ✅
│   │   ├── socket.ts                  # Socket.IO client ✅
│   │   └── utils.ts                   # Utility functions
│   │
│   ├── 📁 pages/                      # Page components
│   │   ├── Dashboard.tsx              # Main dashboard page ✅
│   │   ├── Index.tsx                  # Home/landing page
│   │   ├── LoginPage.tsx              # Login page ✅
│   │   ├── MeetingPage.tsx            # Meeting room page ✅
│   │   ├── NotFound.tsx               # 404 page
│   │   └── PreJoinScreen.tsx          # Pre-join lobby screen ✅
│   │
│   ├── 📁 services/                   # Frontend services
│   │   └── webrtcService.ts           # WebRTC service ✅
│   │
│   ├── App.css                        # App-specific styles
│   ├── App.tsx                        # Main App component ✅
│   ├── index.css                      # Global styles
│   ├── main.tsx                       # React entry point
│   └── vite-env.d.ts                  # Vite type definitions
│
├── .env                               # Environment variables
├── .env.example                       # Example environment variables
├── .gitignore                         # Git ignore rules
├── .prettierignore                    # Prettier ignore rules
├── .prettierrc                        # Prettier configuration
├── components.json                    # shadcn/ui configuration
├── eslint.config.js                   # ESLint configuration
├── index.html                         # HTML template
├── package.json                       # Dependencies and scripts
├── postcss.config.js                  # PostCSS configuration
├── tailwind.config.ts                 # Tailwind CSS configuration
├── tsconfig.app.json                  # TypeScript config (app)
├── tsconfig.json                      # TypeScript config (base)
├── tsconfig.node.json                 # TypeScript config (Node)
├── tsconfig.server.json               # TypeScript config (server)
├── vite.config.ts                     # Vite configuration
├── README.md                          # Project documentation
├── EXECUTION_PLAN.md                  # Execution plan
└── test-server.ts                     # Server test file

```
- **ICE candidate exchange** via Socket.IO signaling

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development servers: `npm run dev`

This starts both frontend (port 5173) and backend (port 3001).

### Available Scripts

- `npm run dev` - Start both frontend and backend
- `npm run client` - Frontend only
- `npm run server` - Backend only  
- `npm run build` - Build for production

## Usage

1. Visit `http://localhost:5173`
2. Enter your name and room ID
3. Test camera/microphone
4. Join meeting

### Meeting Controls
- **Audio/Video**: Toggle on/off
- **Screen Share**: Share with participants
- **Chat**: Real-time messaging
- **Participants**: View attendees

## Architecture

### Multi-Participant WebRTC
- Mesh networking (each peer connects to all others)
- Automatic connection management
- Real-time state synchronization
- Connection recovery and error handling

### Signaling Flow
1. Join room via Socket.IO
2. WebRTC offer/answer exchange
3. ICE candidate negotiation
4. Direct P2P streaming

## Browser Support
- Chrome 80+, Firefox 75+, Safari 13.1+, Edge 80+
- Requires HTTPS in production

## Deployment

### Production Setup
- Frontend: Build and deploy `dist` folder
- Backend: Deploy server with WebSocket support
- Use HTTPS for both services
- Configure STUN/TURN servers

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Submit pull request
## Environment Variables

Create a `.env` file in the root with:

```
# Frontend
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001

# Backend
DATABASE_URL=postgresql://user:password@host:5432/meeting_db
REDIS_URL=redis://...
NEXT_PUBLIC_API_URL=http://localhost:3001
NODE_ENV=development
```

## Project Phases & Status

### ✅ Phase 1: Critical Fixes (COMPLETE)
- WebRTC service connection issues fixed
- Chat event synchronization implemented
- Socket service convenience methods added

### ✅ Phase 2: Major Features (COMPLETE)
- Room management UI with delete functionality
- Participant list with real-time updates
- Control bar fully connected to WebRTC
- Error handling system with toast notifications

### ✅ Phase 3: Integration Fixes (COMPLETE)
- VideoCard enhanced with better stream handling
- ChatSidebar optimized and cleaned
- WebRTC context properly initialized
- PreJoinScreen verified feature-complete

### 🔄 Phase 4: Testing & Polish (IN PROGRESS)
- Comprehensive manual testing
- Browser compatibility verification
- Performance optimization

### 📋 Phase 5: Deployment (PLANNED)
- Production environment setup
- Security hardening
- Performance tuning

## Testing Documentation

- [Phase 3 Testing Guide](PHASE_3_TESTING.md)
- [Phase 4 Test Plan](PHASE_4_PLAN.md)
- [Project Status](PHASE_3_STATUS.md)

## Support

For issues or questions, please refer to:
- [Troubleshooting Guide](TROUBLESHOOTING.md) (if available)
- GitHub Issues
- Documentation in `/docs` folder

## License

MIT License - See LICENSE file for details