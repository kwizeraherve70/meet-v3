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

  // Ensure current user is included safely
  const participants = [];
  const processedUsernames = new Set<string>();
  
  // 1. Add current user
  if (currentUser) {
    const currentUserData = users?.[currentUser];
    participants.push({
      id: "local-user",
      name: `${currentUser} (You)`,
      isMuted: !isAudioEnabled,
      isVideoOn: isVideoEnabled,
      isSpeaking: false,
      avatarColor: "bg-blue-600",
      isLocal: true,
      stream: localStream || null,
      connectionState: currentUserData?.connectionState || 'connected'
    });
    processedUsernames.add(currentUser);
  }

  // 2. Add all other users from the users map safely
  if (users) {
    Object.keys(users).forEach(uname => {
      if (!processedUsernames.has(uname)) {
        const user = users[uname];
        const stream = remoteStreams?.[uname];
        participants.push({
          id: uname,
          name: uname,
          isMuted: !(user?.isAudioEnabled ?? true),
          isVideoOn: user?.isVideoEnabled ?? true,
          isSpeaking: false,
          avatarColor: "bg-green-600",
          isLocal: false,
          stream: stream || null,
          connectionState: user?.connectionState || 'connecting'
        });
        processedUsernames.add(uname);
      }
    });
  }

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

  const getGridConfig = (count: number) => {
    if (count === 1) return "grid-cols-1 max-w-4xl";
    if (count === 2) return "grid-cols-1 md:grid-cols-2 max-w-6xl";
    if (count <= 4) return "grid-cols-2 max-w-6xl";
    return "grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl";
  };

  const gridClass = getGridConfig(participants.length);

  return (
    <div className={`flex-grow w-full h-full overflow-y-auto p-4 pt-28 pb-32 ${isSidebarOpen ? "lg:pr-[340px]" : ""}`}>
      <div className={`grid ${gridClass} gap-6 w-full max-w-[1400px] mx-auto`}>
        {participants.map((participant) => (
          <div key={participant.id} className="w-full animate-fade-in">
            <VideoCard
              name={participant.name}
              isMuted={participant.isMuted}
              isVideoOn={participant.isVideoOn}
              isSpeaking={participant.isSpeaking}
              avatarColor={participant.avatarColor}
              stream={participant.stream}
              isLocal={participant.isLocal}
              connectionState={participant.connectionState}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoGrid;
