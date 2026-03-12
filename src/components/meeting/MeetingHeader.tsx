import { Shield, ChevronDown, Copy, Info, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface MeetingHeaderProps {
  meetingId: string;
  isEncrypted?: boolean;
  isRecording?: boolean;
  recordingDuration?: number;
}

const MeetingHeader = ({ 
  meetingId, 
  isEncrypted = true,
  isRecording = false,
  recordingDuration = 0
}: MeetingHeaderProps) => {
  const [duration, setDuration] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);

  // Update meeting duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Update recording time
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(recordingDuration);
    }
  }, [recordingDuration, isRecording]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (num: number) => String(num).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 glass-dark animate-fade-in">
      <div className="flex items-center gap-3">
        {isEncrypted && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/20 text-success">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium">Encrypted</span>
          </div>
        )}
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Team standup meeting:</span>
          <span className="text-sm font-medium">{meetingId}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Recording indicator and duration */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/50">
            <Circle className="w-2 h-2 rounded-full bg-destructive animate-pulse fill-destructive" />
            <span className="text-xs font-medium text-destructive">
              Recording: {formatTime(recordingTime)}
            </span>
          </div>
        )}

<Button variant="ghost" size="icon" className="h-8 w-8">
          <Info className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};

export default MeetingHeader;
