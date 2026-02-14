import { env } from './env.js';

/**
 * ICE (Interactive Connectivity Establishment) Server Configuration
 * 
 * ICE servers are used by WebRTC to find the best path between peers.
 * - STUN: Helps discover public IP address (free, Google provides public servers)
 * - TURN: Relays media when direct connection fails (requires hosting)
 */

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Default public STUN servers
 * These are free but don't relay traffic - only help with NAT traversal
 */
const defaultStunServers: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

/**
 * Get configured TURN server (if available)
 * TURN servers relay traffic when direct peer connection is not possible
 */
function getTurnServer(): IceServer | null {
  if (!env.TURN_SERVER_URL) {
    return null;
  }

  return {
    urls: env.TURN_SERVER_URL,
    username: env.TURN_USERNAME,
    credential: env.TURN_CREDENTIAL,
  };
}

/**
 * Get complete ICE server configuration
 * Returns array of STUN + TURN servers for WebRTC peer connection
 */
export function getIceServers(): IceServer[] {
  const servers = [...defaultStunServers];
  
  const turnServer = getTurnServer();
  if (turnServer) {
    servers.push(turnServer);
  }

  return servers;
}

/**
 * ICE configuration for RTCPeerConnection
 */
export const iceConfig = {
  iceServers: getIceServers(),
  iceCandidatePoolSize: 10,
};

export default iceConfig;
