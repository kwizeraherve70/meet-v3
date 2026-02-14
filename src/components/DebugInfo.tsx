import React from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';

const DebugInfo = () => {
  const { state, isVideoEnabled, isAudioEnabled } = useWebRTC();

  return (
    <div className="fixed bottom-20 left-4 bg-black bg-opacity-75 text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <h3 className="font-bold mb-2">Debug Info</h3>
      
      <div className="space-y-1">
        <div>Current User: {state.currentUser || 'None'}</div>
        <div>Room ID: {state.roomId || 'None'}</div>
        <div>Local Stream: {state.localStream ? 'Available' : 'None'}</div>
        <div>Video Enabled: {isVideoEnabled ? 'Yes' : 'No'}</div>
        <div>Audio Enabled: {isAudioEnabled ? 'Yes' : 'No'}</div>
        <div>In Call: {state.isInCall ? 'Yes' : 'No'}</div>
        <div>Users Count: {Object.keys(state.users).length}</div>
        <div>Remote Streams: {Object.keys(state.remoteStreams).length}</div>
        
        <div className="mt-2">
          <strong>Users:</strong>
          {Object.keys(state.users).map(username => (
            <div key={username} className="ml-2">
              • {username} {username === state.currentUser ? '(Me)' : ''}
            </div>
          ))}
        </div>
        
        <div className="mt-2">
          <strong>Remote Streams:</strong>
          {Object.keys(state.remoteStreams).map(username => (
            <div key={username} className="ml-2">
              • {username}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DebugInfo;