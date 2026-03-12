import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { WebRTCProvider } from "@/context/WebRTCContext";
import { RecordingProvider, useRecording } from "@/context/RecordingContext";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/context/ToastContext";
import MeetingHeader from "@/components/meeting/MeetingHeader";
import VideoGrid from "@/components/meeting/VideoGrid";
import ControlBar from "@/components/meeting/ControlBar";
import ParticipantsSidebar from "@/components/meeting/ParticipantsSidebar";
import ChatSidebar from "@/components/meeting/ChatSidebar";
import FloatingEmojis, { FloatingReaction } from "@/components/meeting/FloatingEmojis";
import FloatingHands, { FloatingHandReaction } from "@/components/meeting/FloatingHands";
import DebugInfo from "@/components/DebugInfo";
import { socketService } from "@/lib/socket";

const MeetingRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { joinUser, state, isVideoEnabled, isAudioEnabled, toggleVideo, toggleAudio, endCall, startScreenShare, stopScreenShare, isHost } = useWebRTC();
  const { isRecording, recordingDuration } = useRecording();
  
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [floatingHands, setFloatingHands] = useState<FloatingHandReaction[]>([]);

  // Get meeting preferences from localStorage
  const getMeetingPreferences = () => {
    try {
      const saved = localStorage.getItem('meetingPreferences');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const preferences = getMeetingPreferences();
  const username = user?.name || preferences?.username;
  const initialVideo = preferences?.isVideoOn ?? true;
  const initialMic = !(preferences?.isMuted ?? false);

  // Room code (xxx-xxx-xxx) for redirects — numeric roomId in URL is unusable for PreJoinScreen
  // location.state.roomCode is set by all navigate() callers; preferences?.roomId is a fallback
  const roomCode = (location.state as any)?.roomCode || preferences?.roomId;

  useEffect(() => {
    if (!username || !roomId) {
      navigate(roomCode ? `/${roomCode}` : '/join');
      return;
    }

    if (!hasJoined && roomId) {
      joinUser(username, roomId)
        .then(() => {
          setHasJoined(true);
        })
        .catch((error) => {
          console.error('Failed to join meeting:', error);
          navigate(roomCode ? `/${roomCode}` : '/join');
        });
    }
  }, [username, roomId, hasJoined, joinUser, navigate, roomCode]);

  // Setup socket listener for emoji reactions
  useEffect(() => {
    if (!hasJoined || !roomId) return;

    const handleEmojiReaction = (data: any) => {
      const newReaction: FloatingReaction = {
        id: data.id,
        emoji: data.emoji,
        senderName: data.senderName,
        createdAt: data.timestamp,
      };
      
      setFloatingReactions((prev) => [...prev, newReaction]);
    };

    // Register listener and get unsubscribe function
    const unsubscribe = socketService.on('emoji-reaction-received', handleEmojiReaction);

    // Cleanup listener
    return () => {
      unsubscribe();
    };
  }, [hasJoined, roomId]);

  // Setup socket listener for hand raises
  useEffect(() => {
    if (!hasJoined || !roomId) return;

    const handleHandRaised = (data: any) => {
      const newHand: FloatingHandReaction = {
        id: data.id,
        senderName: data.senderName,
        createdAt: data.timestamp,
      };
      
      setFloatingHands((prev) => [...prev, newHand]);
    };

    // Register listener and get unsubscribe function
    const unsubscribe = socketService.on('hand-raised', handleHandRaised);

    // Cleanup listener
    return () => {
      unsubscribe();
    };
  }, [hasJoined, roomId]);

  const handleToggleParticipants = () => {
    setIsParticipantsOpen(!isParticipantsOpen);
    if (!isParticipantsOpen && isChatOpen) {
      setIsChatOpen(false);
    }
  };

  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (!isChatOpen) {
      // Opened — clear unread badge
      setUnreadMessages(0);
      if (isParticipantsOpen) setIsParticipantsOpen(false);
    }
  };

  const handleLeaveMeeting = () => {
    // Clean up meeting preferences
    localStorage.removeItem('meetingPreferences');
    endCall();
    navigate('/');
  };

  const handleToggleVideo = () => {
    toggleVideo(!isVideoEnabled);
  };

  const handleToggleAudio = () => {
    toggleAudio(!isAudioEnabled);
  };

  const handleToggleScreenShare = async () => {
    try {
      if (state.isScreenSharing) {
        await stopScreenShare();
      } else {
        await startScreenShare();
      }
    } catch (error) {
      console.error('Screen sharing error:', error);
      // You could show a toast notification here
    }
  };

  const handleEmojiReaction = (emoji: string) => {
    if (!roomId) return;

    // Emit emoji reaction to server
    socketService.emit('send-emoji-reaction', {
      roomId: parseInt(roomId),
      emoji,
    });
  };

  const handleRemoveFloatingReaction = (reactionId: string) => {
    setFloatingReactions((prev) => prev.filter((r) => r.id !== reactionId));
  };

  const handleRaiseHand = (isRaised: boolean) => {
    if (!roomId) return;

    // Emit raise hand to server
    socketService.emit('raise-hand', {
      roomId: parseInt(roomId),
    });
  };

  const handleRemoveFloatingHand = (handId: string) => {
    setFloatingHands((prev) => prev.filter((h) => h.id !== handId));
  };

  const handleMuteParticipant = (targetUserId: string) => {
    if (!roomId) return;
    
    console.log('🔊 MUTE PARTICIPANT DEBUG:', {
      targetUserId,
      type: typeof targetUserId,
      roomId: parseInt(roomId),
      allUsers: state.users,
    });
    
    socketService.emit('host-mute-participant', {
      roomId: parseInt(roomId),
      targetUserId,
    });
  };

  const handleDisableVideo = (targetUserId: string) => {
    if (!roomId) return;
    
    console.log('📹 DISABLE VIDEO DEBUG:', {
      targetUserId,
      type: typeof targetUserId,
      roomId: parseInt(roomId),
    });
    
    socketService.emit('host-disable-video', {
      roomId: parseInt(roomId),
      targetUserId,
    });
  };

  const handleMuteAll = () => {
    if (!roomId) return;
    socketService.emit('host-mute-all', { roomId: parseInt(roomId) });
  };

  const handleInviteOthers = () => {
    if (!roomId) return;

    // roomCode is the component-level xxx-xxx-xxx code from location.state or preferences
    const inviteLink = roomCode
      ? `${window.location.origin}/${roomCode}`
      : `${window.location.origin}/join`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(inviteLink).then(() => {
      showToast({
        type: 'success',
        title: 'Invite Link Copied',
        description: 'Share this link with anyone - they can join without an account!',
      });
    }).catch(() => {
      showToast({
        type: 'error',
        description: 'Failed to copy link. Please try again.',
      });
    });
  };

  const isSidebarOpen = isParticipantsOpen || isChatOpen;
  const participantCount = Object.keys(state.users).length;

  if (!hasJoined || !username) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Joining meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      <MeetingHeader 
        meetingId={roomId || "Unknown"} 
        isRecording={isRecording}
        recordingDuration={recordingDuration}
      />
      
      <VideoGrid 
        isSidebarOpen={isSidebarOpen}
        localStream={state.localStream}
        remoteStreams={state.remoteStreams}
        users={state.users}
        currentUser={state.currentUser}
        isVideoEnabled={isVideoEnabled}
        isAudioEnabled={isAudioEnabled}
      />
      
      <ControlBar
        onToggleParticipants={handleToggleParticipants}
        onToggleChat={handleToggleChat}
        onLeaveMeeting={handleLeaveMeeting}
        onEmojiReaction={handleEmojiReaction}
        onRaiseHand={handleRaiseHand}
        isParticipantsOpen={isParticipantsOpen}
        isChatOpen={isChatOpen}
        participantCount={participantCount}
        unreadMessages={unreadMessages}
        isMuted={!isAudioEnabled}
        isVideoOn={isVideoEnabled}
        onToggleMute={() => toggleAudio(!isAudioEnabled)}
        onToggleVideo={() => toggleVideo(!isVideoEnabled)}
        isScreenSharing={state.isScreenSharing}
        onToggleScreenShare={handleToggleScreenShare}
        localStream={state.localStream}
        remoteStreams={state.remoteStreams}
      />

      <FloatingEmojis 
        reactions={floatingReactions}
        onRemoveReaction={handleRemoveFloatingReaction}
      />

      <FloatingHands
        hands={floatingHands}
        onRemoveHand={handleRemoveFloatingHand}
      />

      <ParticipantsSidebar
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
        users={state.users}
        currentUser={state.currentUser}
        isCurrentUserHost={isHost}
        onMuteParticipant={handleMuteParticipant}
        onDisableVideo={handleDisableVideo}
        onMuteAll={handleMuteAll}
        onToggleMyAudio={() => toggleAudio(!isAudioEnabled)}
        onToggleMyVideo={() => toggleVideo(!isVideoEnabled)}
        onInviteOthers={handleInviteOthers}
      />

      <ChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        roomId={roomId || ""}
        username={username}
        currentUserId={user?.id}
        onUnreadMessage={() => setUnreadMessages((n) => n + 1)}
      />
      
      {/* Debug info for development */}
      {false && <DebugInfo />}
    </div>
  );
};

const MeetingPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();

  // Get username from preferences as fallback
  const getMeetingPreferences = () => {
    try {
      const saved = localStorage.getItem('meetingPreferences');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const preferences = getMeetingPreferences();
  const username = user?.name || preferences?.username || 'User';
  
  return (
    <WebRTCProvider roomId={roomId}>
      <RecordingProvider roomId={roomId || 'unknown'} username={username}>
        <MeetingRoom />
      </RecordingProvider>
    </WebRTCProvider>
  );
};

export default MeetingPage;