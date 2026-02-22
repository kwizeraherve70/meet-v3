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
import DebugInfo from "@/components/DebugInfo";

const MeetingRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinUser, state, isVideoEnabled, isAudioEnabled, toggleVideo, toggleAudio, endCall, startScreenShare, stopScreenShare } = useWebRTC();
  
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

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