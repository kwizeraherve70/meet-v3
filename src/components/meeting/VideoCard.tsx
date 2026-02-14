import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, Pin, MoreHorizontal, User } from "lucide-react";

interface VideoCardProps {
  name: string;
  isMuted?: boolean;
  isPinned?: boolean;
  isVideoOn?: boolean;
  isSpeaking?: boolean;
  avatarColor?: string;
  stream?: MediaStream | null;
  isLocal?: boolean;
}

const VideoCard = ({
  name,
  isMuted = false,
  isPinned = false,
  isVideoOn = true,
  isSpeaking = false,
  avatarColor = "bg-primary",
  stream = null,
  isLocal = false,
}: VideoCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream && isVideoOn) {
      videoRef.current.srcObject = stream;
      // Ensure video plays
      videoRef.current.play().catch(err => {
        console.warn('Video autoplay failed:', err);
      });
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream, isVideoOn]);

  const hasVideo = isVideoOn && stream;

  return (
    <div
      className={`video-card group transition-all duration-300 relative rounded-lg overflow-hidden bg-gradient-to-br from-card to-video-bg aspect-video ${
        isSpeaking ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "ring-1 ring-border"
      }`}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-card/80 to-video-bg/80">
          {name === "Waiting for others..." ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <User className="w-12 h-12 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">Waiting for others...</p>
            </div>
          ) : (
            <div
              className={`w-24 h-24 rounded-full ${avatarColor} flex items-center justify-center text-3xl font-semibold text-primary-foreground shadow-lg`}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Overlay controls on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2">
        <div className="flex items-center justify-between">
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-md bg-black/40 hover:bg-black/60 transition-colors" title="Pin participant">
              <Pin className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md bg-black/40 hover:bg-black/60 transition-colors" title="More options">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Name tag and media status */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-medium text-white">{name}</span>
          {isMuted ? (
            <MicOff className="w-4 h-4 text-red-400 flex-shrink-0" title="Muted" />
          ) : (
            <Mic className="w-4 h-4 text-green-400 flex-shrink-0" title="Audio on" />
          )}
          {!hasVideo && (
            <VideoOff className="w-4 h-4 text-red-400 flex-shrink-0" title="Video off" />
          )}
        </div>
        {isPinned && (
          <Pin className="w-4 h-4 text-primary flex-shrink-0" title="Pinned" />
        )}
      </div>
    </div>
  );
};

export default VideoCard;
