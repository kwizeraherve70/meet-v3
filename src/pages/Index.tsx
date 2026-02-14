import { useState } from "react";
import MeetingHeader from "@/components/meeting/MeetingHeader";
import VideoGrid from "@/components/meeting/VideoGrid";
import ControlBar from "@/components/meeting/ControlBar";
import ParticipantsSidebar from "@/components/meeting/ParticipantsSidebar";
import ChatSidebar from "@/components/meeting/ChatSidebar";

const Index = () => {
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleToggleParticipants = () => {
    setIsParticipantsOpen(!isParticipantsOpen);
    if (!isParticipantsOpen && isChatOpen) {
      setIsChatOpen(false);
    }
  };

  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (!isChatOpen && isParticipantsOpen) {
      setIsParticipantsOpen(false);
    }
  };

  const isSidebarOpen = isParticipantsOpen || isChatOpen;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      <MeetingHeader meetingId="847-294-1038" />
      
      <VideoGrid isSidebarOpen={isSidebarOpen} />
      
      <ControlBar
        onToggleParticipants={handleToggleParticipants}
        onToggleChat={handleToggleChat}
        isParticipantsOpen={isParticipantsOpen}
        isChatOpen={isChatOpen}
        participantCount={6}
        unreadMessages={3}
      />

      <ParticipantsSidebar
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
      />

      <ChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
};

export default Index;
