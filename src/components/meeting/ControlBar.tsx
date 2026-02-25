import { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Users,
  MessageSquare,
  MoreHorizontal,
  PhoneOff,
  Hand,
  SmilePlus,
  Settings,
  Circle,
  Captions,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmojiPicker from "./EmojiPicker";

interface ControlBarProps {
  onToggleParticipants: () => void;
  onToggleChat: () => void;
  onLeaveMeeting?: () => void;
  onEmojiReaction?: (emoji: string) => void;
  onRaiseHand?: (isRaised: boolean) => void;
  isParticipantsOpen: boolean;
  isChatOpen: boolean;
  participantCount: number;
  unreadMessages: number;
  isMuted?: boolean;
  isVideoOn?: boolean;
  onToggleMute?: () => void;
  onToggleVideo?: () => void;
  isScreenSharing?: boolean;
  onToggleScreenShare?: () => void;
}

const ControlBar = ({
  onToggleParticipants,
  onToggleChat,
  onLeaveMeeting,
  onEmojiReaction,
  onRaiseHand,
  isParticipantsOpen,
  isChatOpen,
  participantCount,
  unreadMessages,
  isMuted = false,
  isVideoOn = true,
  onToggleMute,
  onToggleVideo,
  isScreenSharing = false,
  onToggleScreenShare,
}: ControlBarProps) => {
  const [isHandRaised, setIsHandRaised] = useState(false);

  const handleRaiseHand = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    onRaiseHand?.(newState);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 animate-slide-up pointer-events-none">
      <div className="flex items-center justify-center px-4 py-4">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Audio control */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMuted ? "controlActive" : "control"}
                size="control"
                onClick={onToggleMute}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isMuted ? "Unmute" : "Mute"}</p>
            </TooltipContent>
          </Tooltip>

          {/* Video control */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={!isVideoOn ? "controlActive" : "control"}
                size="control"
                onClick={onToggleVideo}
              >
                {!isVideoOn ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{!isVideoOn ? "Start Video" : "Stop Video"}</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-8 bg-border mx-2" />

          {/* Share screen */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isScreenSharing ? "controlPrimary" : "control"}
                size="control"
                onClick={onToggleScreenShare}
              >
                <MonitorUp className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isScreenSharing ? "Stop Sharing" : "Share Screen"}</p>
            </TooltipContent>
          </Tooltip>

          {/* Raise hand */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isHandRaised ? "controlPrimary" : "control"}
                size="control"
                onClick={handleRaiseHand}
              >
                <Hand className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isHandRaised ? "Lower Hand" : "Raise Hand"}</p>
            </TooltipContent>
          </Tooltip>

          {/* Reactions Emoji Picker */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <EmojiPicker onEmojiSelect={onEmojiReaction} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reactions</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-8 bg-border mx-2" />

          {/* Participants */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isParticipantsOpen ? "controlPrimary" : "control"}
                size="control"
                onClick={onToggleParticipants}
                className="relative"
              >
                <Users className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-xs flex items-center justify-center font-medium">
                  {participantCount}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Participants</p>
            </TooltipContent>
          </Tooltip>

          {/* Chat */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isChatOpen ? "controlPrimary" : "control"}
                size="control"
                onClick={onToggleChat}
                className="relative"
              >
                <MessageSquare className="w-5 h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-xs flex items-center justify-center font-medium">
                    {unreadMessages}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chat</p>
            </TooltipContent>
          </Tooltip>

          {/* More options */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="control" size="control">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>More</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuItem>
                <Circle className="w-4 h-4 mr-2 text-destructive" />
                Record Meeting
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Captions className="w-4 h-4 mr-2" />
                Enable Captions
              </DropdownMenuItem>
              <DropdownMenuItem>
                <LayoutGrid className="w-4 h-4 mr-2" />
                Change Layout
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-8 bg-border mx-2" />

          {/* End call */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="endCall" onClick={onLeaveMeeting}>
                <PhoneOff className="w-5 h-5" />
                <span>Leave</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Leave Meeting</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default ControlBar;
