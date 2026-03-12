import { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Users,
  MessageSquare,
  PhoneOff,
  Hand,
  Circle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import EmojiPicker from "./EmojiPicker";
import { useRecording } from "@/context/RecordingContext";
import { useToast } from "@/context/ToastContext";

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
  localStream?: MediaStream;
  remoteStreams?: Record<string, MediaStream>;
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
  localStream,
  remoteStreams = {},
}: ControlBarProps) => {
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showRecordingConfirm, setShowRecordingConfirm] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    uploadRecording,
    downloadRecording,
    error: recordingError,
    clearError
  } = useRecording();
  const { showToast } = useToast();

  const handleRaiseHand = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    onRaiseHand?.(newState);
  };

  const handleRecordingToggle = () => {
    if (!isRecording) {
      // Confirm before starting
      setShowRecordingConfirm(true);
    } else {
      // Stop recording
      handleStopRecording();
    }
  };

  const handleStartRecording = async () => {
    try {
      setShowRecordingConfirm(false);
      
      if (!localStream) {
        showToast({
          type: 'error',
          description: 'Local stream not available',
        });
        return;
      }

      // Collect all streams (local + remote)
      const streams: MediaStream[] = [localStream];
      Object.values(remoteStreams).forEach((stream) => {
        streams.push(stream);
      });

      await startRecording(streams);
      showToast({
        type: 'success',
        title: 'Recording Started',
        description: 'Your meeting is now being recorded',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Recording Failed',
        description: error instanceof Error ? error.message : 'Failed to start recording',
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      setIsUploadingRecording(true);
      const blob = await stopRecording();
      
      if (!blob) {
        showToast({
          type: 'error',
          description: 'Failed to stop recording',
        });
        return;
      }

      // Show options to upload or download
      const timestamp = new Date().toLocaleString();
      const filename = `meeting-recording-${timestamp}.webm`;

      // Automatically upload to server
      try {
        await uploadRecording(blob, filename);
        showToast({
          type: 'success',
          title: 'Recording Uploaded',
          description: 'Your recording has been saved to the server',
        });
      } catch {
        // Fallback to local download if upload fails
        downloadRecording(blob, filename);
        showToast({
          type: 'success',
          title: 'Recording Saved',
          description: 'Recording saved locally. You can upload it later.',
        });
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Recording Error',
        description: error instanceof Error ? error.message : 'Failed to process recording',
      });
    } finally {
      setIsUploadingRecording(false);
    }
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

          {/* Recording */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isRecording ? "controlActive" : "control"}
                size="control"
                onClick={handleRecordingToggle}
                disabled={isUploadingRecording}
              >
                {isUploadingRecording ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isRecording ? (
                  <Circle className="w-5 h-5 fill-current animate-pulse" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isUploadingRecording ? "Saving Recording..." : isRecording ? "Stop Recording" : "Start Recording"}</p>
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

      {/* Recording confirmation dialog */}
      <AlertDialog open={showRecordingConfirm} onOpenChange={setShowRecordingConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This will record your meeting including video and audio from all participants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartRecording}>
              Start Recording
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recording error toast */}
      {recordingError && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm z-50">
          {recordingError}
          <button
                onClick={clearError}
            className="ml-2 font-bold hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default ControlBar;
