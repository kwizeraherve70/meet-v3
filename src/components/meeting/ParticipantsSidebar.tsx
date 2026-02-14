import { X, Search, Mic, MicOff, Video, VideoOff, MoreHorizontal, Hand, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User } from "@/services/webrtcService";
import { useState } from "react";

interface ParticipantsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  users?: { [key: string]: User };
  currentUser?: string | null;
}

const ParticipantsSidebar = ({ isOpen, onClose, users = {}, currentUser = null }: ParticipantsSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const participantList = Object.entries(users).map(([username, user]) => ({
    id: user.id || username,
    name: username,
    isMuted: !user.isAudioEnabled,
    isVideoOn: user.isVideoEnabled,
    isHost: false, // Could be extended with actual host info
    isMe: username === currentUser,
  }));

  const filteredParticipants = participantList.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 glass-dark border-l border-border animate-slide-up z-10">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Participants ({filteredParticipants.length})</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search participants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary border-0"
            />
          </div>
        </div>

        {/* Participants list */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1">
            {filteredParticipants.length > 0 ? (
              filteredParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group"
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{participant.name}</span>
                      {participant.isHost && (
                        <Crown className="w-4 h-4 text-yellow-500" title="Host" />
                      )}
                      {participant.isMe && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">You</span>
                      )}
                    </div>
                  </div>

                  {/* Status icons */}
                  <div className="flex items-center gap-1.5">
                    {participant.isMuted ? (
                      <MicOff className="w-4 h-4 text-destructive" title="Muted" />
                    ) : (
                      <Mic className="w-4 h-4 text-green-500" title="Audio on" />
                    )}
                    {participant.isVideoOn ? (
                      <Video className="w-4 h-4 text-green-500" title="Video on" />
                    ) : (
                      <VideoOff className="w-4 h-4 text-destructive" title="Video off" />
                    )}
                    {!participant.isMe && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No participants found</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="p-4 border-t border-border space-y-2">
          <Button variant="outline" className="w-full">
            Mute All
          </Button>
          <Button variant="default" className="w-full">
            Invite Others
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantsSidebar;
