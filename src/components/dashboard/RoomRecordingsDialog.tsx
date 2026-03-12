import { useEffect, useState } from "react";
import { Download, Play, Film, Clock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiClient, API_BASE_URL, RecordingItem } from "@/lib/api";

interface RoomRecordingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  roomTitle: string;
}

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const RoomRecordingsDialog = ({
  open,
  onOpenChange,
  roomId,
  roomTitle,
}: RoomRecordingsDialogProps) => {
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setError(null);
    apiClient
      .getRoomRecordings(roomId)
      .then((data) => setRecordings(data.recordings))
      .catch(() => setError("Failed to load recordings"))
      .finally(() => setIsLoading(false));
  }, [open, roomId]);

  const handleDownload = (recording: RecordingItem) => {
    const a = document.createElement("a");
    a.href = `${API_BASE_URL}${recording.fileUrl}`;
    a.download = `${recording.title}.webm`;
    a.click();
  };

  const handlePlay = (recording: RecordingItem) => {
    window.open(`${API_BASE_URL}${recording.fileUrl}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            Recordings — {roomTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <p className="text-center text-destructive py-8">{error}</p>
          )}

          {!isLoading && !error && recordings.length === 0 && (
            <div className="text-center py-12">
              <Film className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">No recordings yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start a recording during a meeting to see it here
              </p>
            </div>
          )}

          {!isLoading && recordings.length > 0 && (
            <div className="space-y-3">
              {recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Film className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {rec.title}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDuration(rec.duration)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(rec.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handlePlay(rec)}
                    >
                      <Play className="w-3.5 h-3.5" />
                      Play
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleDownload(rec)}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoomRecordingsDialog;
