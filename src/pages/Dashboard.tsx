import { useState, useEffect } from "react";
import { Video, Plus, Calendar, LogOut, Clock, ArrowRight, Copy, Check, AlertCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import MeetingActionCard from "@/components/dashboard/MeetingActionCard";
import UpcomingMeetingCard from "@/components/dashboard/UpcomingMeetingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiClient, RoomResponse } from "@/lib/api";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [isNewMeetingDialogOpen, setIsNewMeetingDialogOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [roomLinkCopied, setRoomLinkCopied] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<RoomResponse | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Load user's rooms on component mount
  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const userRooms = await apiClient.getUserRooms();
      setRooms(userRooms);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      setError('Failed to load your rooms. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a meeting title',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreatingRoom(true);
      const newRoom = await apiClient.createRoom(
        newRoomTitle.trim(),
        newRoomDescription.trim() || undefined
      );
      setCreatedRoom(newRoom);
      setRooms([newRoom, ...rooms]);
      toast({
        title: 'Success',
        description: 'Meeting created successfully!',
      });
    } catch (err) {
      console.error('Failed to create room:', err);
      toast({
        title: 'Error',
        description: 'Failed to create meeting. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleStartMeetingNow = () => {
    if (createdRoom && user) {
      // Set meeting preferences to enable camera and audio by default for the host
      const meetingPreferences = {
        username: user.name || 'Host',
        isVideoOn: true,
        isMuted: false,
        roomId: createdRoom.roomCode,
        roomDatabaseId: createdRoom.id,
        isGuest: false
      };
      localStorage.setItem('meetingPreferences', JSON.stringify(meetingPreferences));

      navigate(`/meeting/${createdRoom.id}`, {
        state: { roomCode: createdRoom.roomCode }
      });
      setIsNewMeetingDialogOpen(false);
      setNewRoomTitle('');
      setNewRoomDescription('');
      setCreatedRoom(null);
    }
  };

  const handleCopyRoomLink = () => {
    if (createdRoom) {
      const roomLink = `${window.location.origin}/${createdRoom.roomCode}`;
      navigator.clipboard.writeText(roomLink).then(() => {
        setRoomLinkCopied(true);
        toast({
          title: "Room link copied!",
          description: "Share this link with others to join the meeting.",
        });
        setTimeout(() => setRoomLinkCopied(false), 2000);
      });
    }
  };

  const handleJoinRoom = async () => {
    if (!joinRoomId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a meeting ID',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsJoiningRoom(true);
      let roomCode = joinRoomId.trim();
      
      // Extract room code from URL if pasted
      if (roomCode.includes('://')) {
        roomCode = roomCode.split('/').pop() || roomCode;
      } else if (roomCode.includes('/')) {
        roomCode = roomCode.split('/').pop() || roomCode;
      }

      const room = await apiClient.getRoomByCode(roomCode);
      navigate(`/meeting/${room.id}`, {
        state: { roomCode: room.roomCode }
      });
    } catch (err) {
      console.error('Failed to join room:', err);
      toast({
        title: 'Error',
        description: 'Failed to join meeting. Please check the meeting ID.',
        variant: 'destructive',
      });
    } finally {
      setIsJoiningRoom(false);
      setJoinRoomId("");
      setIsJoinDialogOpen(false);
    }
  };

  const handleDeleteRoom = async (roomCode: string, roomId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this meeting?')) {
      return;
    }
    
    try {
      await apiClient.deleteRoom(roomCode);
      setRooms(rooms.filter(r => r.id !== roomId));
      toast({
        title: 'Success',
        description: 'Meeting deleted successfully',
      });
    } catch (err) {
      console.error('Failed to delete room:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete meeting',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 md:p-12 mb-8">
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p className="text-muted-foreground mb-2">{currentDate}</p>
                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                  {currentTime}
                </h1>
                <p className="text-lg text-muted-foreground">
                  Welcome back, {user?.name || 'User'}! Ready for your next meeting?
                </p>
              </div>
              <Dialog open={isNewMeetingDialogOpen} onOpenChange={setIsNewMeetingDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="default" className="gap-2">
                    <Video className="w-5 h-5" />
                    New Meeting
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a New Meeting</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {!createdRoom ? (
                      <>
                        <div>
                          <label className="text-sm font-medium">Meeting Title *</label>
                          <Input
                            placeholder="Enter meeting title"
                            value={newRoomTitle}
                            onChange={(e) => setNewRoomTitle(e.target.value)}
                            disabled={isCreatingRoom}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Description (optional)</label>
                          <Input
                            placeholder="Enter meeting description"
                            value={newRoomDescription}
                            onChange={(e) => setNewRoomDescription(e.target.value)}
                            disabled={isCreatingRoom}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setIsNewMeetingDialogOpen(false);
                              setNewRoomTitle('');
                              setNewRoomDescription('');
                            }}
                            disabled={isCreatingRoom}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleCreateRoom}
                            disabled={isCreatingRoom || !newRoomTitle.trim()}
                          >
                            {isCreatingRoom ? 'Creating...' : 'Create Meeting'}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-sm font-medium">Meeting Created!</label>
                          <div className="mt-2 p-3 bg-primary/10 rounded-lg">
                            <p className="text-sm font-medium text-foreground">{createdRoom.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              ID: {createdRoom.roomCode}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Share Meeting Link</label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={`${window.location.origin}/${createdRoom.roomCode}`}
                              readOnly
                              className="bg-muted text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCopyRoomLink}
                              className="gap-1 flex-shrink-0"
                            >
                              {roomLinkCopied ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setIsNewMeetingDialogOpen(false);
                              setNewRoomTitle('');
                              setNewRoomDescription('');
                              setCreatedRoom(null);
                            }}
                          >
                            Close
                          </Button>
                          <Button onClick={handleStartMeetingNow}>
                            Start Meeting Now
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
            <DialogTrigger asChild>
              <div className="cursor-pointer">
                <MeetingActionCard
                  icon={Video}
                  title="Join Meeting"
                  description="Join via meeting ID"
                  color="success"
                />
              </div>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join a Meeting</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">Meeting ID or URL</label>
                  <Input
                    placeholder="Enter meeting ID or paste meeting link"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    disabled={isJoiningRoom}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Example: abc-def-ghi
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsJoinDialogOpen(false)}
                    disabled={isJoiningRoom}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleJoinRoom}
                    disabled={!joinRoomId.trim() || isJoiningRoom}
                  >
                    {isJoiningRoom ? 'Joining...' : 'Join'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div onClick={() => navigate('/schedule')} className="cursor-pointer">
            <MeetingActionCard
              icon={Calendar}
              title="Schedule"
              description="Plan ahead"
              color="orange"
            />
          </div>

          <div onClick={handleLogout} className="cursor-pointer">
            <MeetingActionCard
              icon={LogOut}
              title="Logout"
              description="Sign out"
              color="red"
            />
          </div>

          <div className="cursor-pointer opacity-50">
            <MeetingActionCard
              icon={Plus}
              title="More"
              description="Coming soon"
              color="purple"
            />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Your Meetings */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                Your Meetings
              </h2>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading your meetings...</p>
            </div>
          ) : rooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="relative group cursor-pointer"
                >
                  <div
                    onClick={() => navigate(`/meeting/${room.id}`, {
                      state: { roomCode: room.roomCode }
                    })}
                  >
                    <UpcomingMeetingCard
                      title={room.title}
                      time={new Date(room.createdAt).toLocaleTimeString()}
                      date={new Date(room.createdAt).toLocaleDateString()}
                      participants={room.participantCount ?? 0}
                      isLive={room.isActive}
                    />
                  </div>
                  {/* Delete button overlay */}
                  <button
                    onClick={(e) => handleDeleteRoom(room.roomCode, room.id, e)}
                    className="absolute top-2 right-2 p-2 bg-destructive/90 hover:bg-destructive rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete meeting"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/50 rounded-lg">
              <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No meetings yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create or join a meeting to get started</p>
            </div>
          )}
        </div>

        {/* Quick Tips */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-3">Quick Tips</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Share your meeting link to invite others</li>
            <li>• Test your camera and microphone before joining</li>
            <li>• Use the chat feature for real-time communication</li>
            <li>• Screen sharing is available during meetings</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
