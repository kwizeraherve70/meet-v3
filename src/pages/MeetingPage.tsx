import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WebRTCProvider } from "@/context/WebRTCContext";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();
  const { joinUser, state, isVideoEnabled, isAudioEnabled, toggleVideo, toggleAudio, endCall, startScreenShare, stopScreenShare } = useWebRTC();
  
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

  useEffect(() => {
    if (!username || !roomId) {
      // Redirect to prejoin screen with room ID if no username
      navigate(`/${roomId || ''}`);
      return;
    }

    if (!hasJoined && roomId) {
      joinUser(username, roomId)
        .then(() => {
          setHasJoined(true);
          // Media preferences are already applied during joinUser
          // No need to toggle video/audio here
        })
        .catch((error) => {
          console.error('Failed to join meeting:', error);
          navigate(`/${roomId || ''}`);
        });
    }
  }, [username, roomId, hasJoined, joinUser, navigate]);

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
      <MeetingHeader meetingId={roomId || "Unknown"} />
      
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
  
  return (
    <WebRTCProvider roomId={roomId}>
      <MeetingRoom />
    </WebRTCProvider>
  );
};

export default MeetingPage;