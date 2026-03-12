import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, ArrowLeft, Check } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";

interface ScheduledMeeting {
  id: string;
  title: string;
  description: string;
  scheduledDate: string;
  scheduledTime: string;
  roomCode?: string;
  createdAt: string;
}

const SchedulePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledMeetings, setScheduledMeetings] = useState<ScheduledMeeting[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleScheduleMeeting = async () => {
    // Validation
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a meeting title",
        variant: "destructive",
      });
      return;
    }

    if (!scheduledDate) {
      toast({
        title: "Error",
        description: "Please select a date",
        variant: "destructive",
      });
      return;
    }

    if (!scheduledTime) {
      toast({
        title: "Error",
        description: "Please select a time",
        variant: "destructive",
      });
      return;
    }

    // Check if the selected date and time is in the future
    const selectedDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (selectedDateTime <= new Date()) {
      toast({
        title: "Error",
        description: "Please select a future date and time",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsScheduling(true);
      setError(null);

      // Create a meeting room for the scheduled meeting
      const newRoom = await apiClient.createRoom(
        title.trim(),
        description.trim() || undefined
      );

      // Create the scheduled meeting object
      const scheduledMeeting: ScheduledMeeting = {
        id: `scheduled-${Date.now()}`,
        title: title.trim(),
        description: description.trim() || "",
        scheduledDate,
        scheduledTime,
        roomCode: newRoom.roomCode,
        createdAt: new Date().toISOString(),
      };

      // Save to local storage (or backend)
      const existingMeetings = JSON.parse(
        localStorage.getItem("scheduledMeetings") || "[]"
      );
      localStorage.setItem(
        "scheduledMeetings",
        JSON.stringify([scheduledMeeting, ...existingMeetings])
      );

      setScheduledMeetings([scheduledMeeting, ...scheduledMeetings]);

      toast({
        title: "Success",
        description: `Meeting scheduled for ${scheduledDate} at ${scheduledTime}`,
      });

      setShowSuccess(true);
      // Reset form
      setTitle("");
      setDescription("");
      setScheduledDate("");
      setScheduledTime("");

      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Failed to schedule meeting:", err);
      setError("Failed to schedule meeting. Please try again.");
      toast({
        title: "Error",
        description: "Failed to schedule meeting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDateTime = (date: string, time: string) => {
    const dateObj = new Date(`${date}T${time}`);
    return dateObj.toLocaleString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Schedule Meeting</h1>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Meeting scheduled successfully!
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Schedule Form */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Create New Scheduled Meeting
            </h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Meeting Title *
                </label>
                <Input
                  placeholder="e.g., Team Standup"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isScheduling}
                  className="mt-1"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Description (optional)
                </label>
                <Input
                  placeholder="e.g., Weekly team meeting"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isScheduling}
                  className="mt-1"
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date *
                </label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  disabled={isScheduling}
                  min={getMinDateTime()}
                  className="mt-1"
                />
              </div>

              {/* Time */}
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Time *
                </label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  disabled={isScheduling}
                  className="mt-1"
                />
              </div>

              {/* Schedule Button */}
              <Button
                onClick={handleScheduleMeeting}
                disabled={isScheduling}
                className="w-full mt-6 gap-2"
                size="lg"
              >
                {isScheduling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Schedule Meeting
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Info Section */}
          <div>
            {/* Meeting Preview */}
            {title && scheduledDate && scheduledTime && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Preview
                </h3>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">{title}</p>
                  {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-3">
                    <Calendar className="w-4 h-4" />
                    {formatDateTime(scheduledDate, scheduledTime)}
                  </p>
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Tips</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• Schedule meetings in advance for better planning</li>
                <li>• Set a clear title for easy identification</li>
                <li>• Choose a time that works for all participants</li>
                <li>• You'll get a unique link to share with others</li>
                <li>
                  • Scheduled meetings are automatically created and ready to
                  join
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Scheduled Meetings List */}
        {scheduledMeetings.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Your Scheduled Meetings
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {scheduledMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                >
                  <h3 className="font-semibold text-foreground mb-2">
                    {meeting.title}
                  </h3>
                  {meeting.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {meeting.description}
                    </p>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {formatDateTime(meeting.scheduledDate, meeting.scheduledTime)}
                    </p>
                    {meeting.roomCode && (
                      <p className="text-xs text-muted-foreground">
                        Room: {meeting.roomCode}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SchedulePage;
