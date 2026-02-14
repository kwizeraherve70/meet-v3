import VideoCard from "./VideoCard";
import { User } from "@/services/webrtcService";

interface VideoGridProps {
  isSidebarOpen?: boolean;
  localStream?: MediaStream | null;
  remoteStreams?: { [username: string]: MediaStream };
  users?: { [username: string]: User };
  currentUser?: string | null;
  isVideoEnabled?: boolean;
  isAudioEnabled?: boolean;
}

const VideoGrid = ({ 
  isSidebarOpen = false,
  localStream = null,
  remoteStreams = {},
  users = {},
  currentUser = null,
  isVideoEnabled = true,
  isAudioEnabled = true
}: VideoGridProps) => {
  // Convert users object to array for easier handling
  const userArray = Object.values(users);
  const participantCount = userArray.length;

  // Ensure current user is included even if not in users object yet
  const participants = [];
  
  // Add current user if we have their info
  if (currentUser && localStream) {
    const currentUserData = users[currentUser];
    participants.push({
      id: currentUser,
      name: currentUser,
      isMuted: !isAudioEnabled,
      isVideoOn: isVideoEnabled,
      isSpeaking: false,
      avatarColor: "bg-blue-600",
      isLocal: true,
      stream: localStream,
      connectionState: currentUserData?.connectionState || 'connected'
    });
  }

  // Add remote users
  userArray.forEach(user => {
    if (user.username !== currentUser) {
      const stream = remoteStreams[user.username];
      participants.push({
        id: user.username,
        name: user.username,
        isMuted: !(user.isAudioEnabled ?? true),
        isVideoOn: user.isVideoEnabled ?? true,
        isSpeaking: false,
        avatarColor: "bg-green-600",
        isLocal: false,
        stream: stream || null,
        connectionState: user.connectionState || 'connecting'
      });
    }
  });

  // Fallback for no participants - show waiting message
  if (participants.length === 0) {
    participants.push({
      id: "waiting",
      name: "Waiting for others...",
      isMuted: false,
      isVideoOn: false,
      isSpeaking: false,
      avatarColor: "bg-muted",
      isLocal: false,
      stream: null,
      connectionState: undefined
    });
  }

  const gridCols = participants.length <= 2 
    ? "grid-cols-1 md:grid-cols-2" 
    : participants.length <= 4 
    ? "grid-cols-2" 
    : "grid-cols-2 lg:grid-cols-3";

  return (
    <div 
      className={`flex-1 p-4 pt-20 pb-24 overflow-auto transition-all duration-300 ${
        isSidebarOpen ? "pr-[340px]" : ""
      }`}
    >
      <div className={`grid ${gridCols} gap-3 h-full auto-rows-fr max-w-6xl mx-auto`}>
        {participants.map((participant) => (
          <VideoCard
            key={participant.id}
            name={participant.name}
            isMuted={participant.isMuted}
            isVideoOn={participant.isVideoOn}
            isSpeaking={participant.isSpeaking}
            avatarColor={participant.avatarColor}
            stream={participant.stream}
            isLocal={participant.isLocal}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoGrid;
