import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import WebRTCService, { CallState } from '../services/webrtcService';
import { socketService } from '@/lib/socket';

interface WebRTCContextType {
  state: CallState;
  webrtcService: WebRTCService | null;
  joinUser: (username: string) => Promise<void>;
  startCall: (targetUser: string) => Promise<void>;
  endCall: () => void;
  toggleVideo: (enabled: boolean) => void;
  toggleAudio: (enabled: boolean) => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
}

export const WebRTCContext = createContext<WebRTCContextType | null>(null);

export const WebRTCProvider: React.FC<{ children: React.ReactNode; roomId?: string }> = ({ children, roomId }) => {
  const [state, setState] = useState<CallState>({
    isInCall: false,
    localStream: null,
    remoteStreams: {},
    users: {},
    currentUser: null,
    roomId: null,
    isScreenSharing: false,
    screenShareStream: null
  });
  
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const webrtcServiceRef = useRef<WebRTCService | null>(null);

  useEffect(() => {
    // Initialize WebRTC service only once and persist it
    if (!webrtcServiceRef.current) {
      console.log('WebRTCContext: Initializing WebRTC service...');
      webrtcServiceRef.current = new WebRTCService();
      webrtcServiceRef.current.setStateChangeCallback((newState: CallState) => {
        console.log('WebRTCContext: State updated:', newState);
        setState(newState);
        
        // Update local video/audio state from the service state
        if (newState.currentUser && newState.users[newState.currentUser]) {
          const currentUserData = newState.users[newState.currentUser];
          setIsVideoEnabled(currentUserData.isVideoEnabled ?? true);
          setIsAudioEnabled(currentUserData.isAudioEnabled ?? true);
        }
      });
      
      // Get initial state
      const initialState = webrtcServiceRef.current.getState();
      console.log('WebRTCContext: Initial state:', initialState);
      setState(initialState);
    }

    // Cleanup function - only disconnect on actual unmount, not HMR
    return () => {
      // Only cleanup on actual page navigation/close, not on HMR
      if (process.env.NODE_ENV !== 'development') {
        if (webrtcServiceRef.current) {
          console.log('WebRTCContext: Cleaning up service...');
          webrtcServiceRef.current.disconnect();
          webrtcServiceRef.current = null;
        }
      }
    };
  }, []); // Empty dependency array to run only once

  const joinUser = async (username: string): Promise<void> => {
    // ✅ ADDED: Initialize socket connection BEFORE joining room
    try {
      if (!socketService.isSocketConnected()) {
        console.log('🔌 Connecting socket before joining room...');
        await socketService.connect();
        console.log('✅ Socket connected successfully');
      } else {
        console.log('✅ Socket already connected');
      }
    } catch (error) {
      console.error('❌ Socket connection failed:', error);
      throw new Error('Could not establish connection. Please try again.');
    }

    if (webrtcServiceRef.current) {
      // Check if we already have a session for this user/room combination
      const currentState = webrtcServiceRef.current.getState();
      if (currentState.currentUser === username && currentState.roomId === (roomId || 'default')) {
        console.log('User already joined with current session');
        return;
      }
      
      console.log('WebRTCContext: Joining user:', username, 'in room:', roomId || 'default');
      await webrtcServiceRef.current.joinUser(username, roomId || 'default');
    }
  };

  const startCall = async (targetUser: string): Promise<void> => {
    if (webrtcServiceRef.current) {
      await webrtcServiceRef.current.startCall(targetUser);
    }
  };

  const endCall = (): void => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.endCall();
    }
  };

  const toggleVideo = (enabled: boolean): void => {
    setIsVideoEnabled(enabled);
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.toggleVideo(enabled);
    }
  };

  const toggleAudio = (enabled: boolean): void => {
    setIsAudioEnabled(enabled);
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.toggleAudio(enabled);
    }
  };

  const startScreenShare = async (): Promise<void> => {
    if (webrtcServiceRef.current) {
      await webrtcServiceRef.current.startScreenShare();
    }
  };

  const stopScreenShare = async (): Promise<void> => {
    if (webrtcServiceRef.current) {
      await webrtcServiceRef.current.stopScreenShare();
    }
  };

  return (
    <WebRTCContext.Provider
      value={{
        state,
        webrtcService: webrtcServiceRef.current,
        joinUser,
        startCall,
        endCall,
        toggleVideo,
        toggleAudio,
        startScreenShare,
        stopScreenShare,
        isVideoEnabled,
        isAudioEnabled
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
};