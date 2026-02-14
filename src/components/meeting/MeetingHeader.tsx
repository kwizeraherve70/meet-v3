import { Shield, ChevronDown, Copy, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeetingHeaderProps {
  meetingId: string;
  isEncrypted?: boolean;
}

const MeetingHeader = ({ meetingId, isEncrypted = true }: MeetingHeaderProps) => {
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

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/50">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium">01:23:45</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Info className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};

export default MeetingHeader;
