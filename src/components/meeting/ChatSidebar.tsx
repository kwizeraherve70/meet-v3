import { useState, useEffect, useRef } from "react";
import { X, Send, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { socketService } from "@/lib/socket";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isMe: boolean;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  username?: string;
  /** Numeric user ID of the current user (undefined for guests not yet known). */
  currentUserId?: number | null;
  /** Called whenever a new message arrives while the chat panel is closed. */
  onUnreadMessage?: () => void;
}

const ChatSidebar = ({
  isOpen,
  onClose,
  roomId = "",
  username = "Anonymous",
  currentUserId,
  onUnreadMessage,
}: ChatSidebarProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(socketService.isSocketConnected());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Keep a ref so event callbacks always see the current isOpen value
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Track socket connection status so the input reflects real-time availability
  useEffect(() => {
    // Poll every second — lightweight and avoids complex socket event wiring
    const interval = setInterval(() => {
      setIsConnected(socketService.isSocketConnected());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Set up socket listeners
  useEffect(() => {
    if (!roomId) return;

    // ── Handle incoming messages (from server broadcast) ──────────────────────
    const handleMessageReceived = (data: any) => {
      const newMsg: Message = {
        id: data.id?.toString() || Date.now().toString(),
        sender: data.userName || "Unknown",
        content: data.content || "",
        timestamp: new Date(data.timestamp || data.created_at || Date.now()).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        // Use numeric userId for reliable self-identification
        isMe:
          currentUserId != null
            ? data.userId === currentUserId
            : data.userName === username,
      };

      setMessages((prev) => [...prev, newMsg]);

      // Notify parent for unread badge when chat is closed
      if (!isOpenRef.current && onUnreadMessage) {
        onUnreadMessage();
      }
    };

    // ── Handle chat history (loaded on open) ─────────────────────────────────
    const handleMessageHistory = (data: any) => {
      const historyMessages: Message[] = (data.messages || []).map((m: any) => ({
        id: m.id?.toString() || Date.now().toString(),
        sender: m.user?.name || m.guestName || "Unknown",
        content: m.content || "",
        timestamp: new Date(m.createdAt || m.created_at || Date.now()).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isMe:
          currentUserId != null
            ? m.userId === currentUserId
            : (m.user?.name || m.guestName) === username,
      }));
      setMessages(historyMessages);
    };

    const unsubscribeReceived = socketService.on("message-received", handleMessageReceived);
    const unsubscribeHistory = socketService.on("message-history", handleMessageHistory);

    return () => {
      unsubscribeReceived();
      unsubscribeHistory();
    };
  }, [roomId, username, currentUserId, onUnreadMessage]);

  // Request chat history whenever the panel opens
  useEffect(() => {
    if (!isOpen || !roomId) return;

    const timer = setTimeout(() => {
      if (socketService.isSocketConnected()) {
        socketService.requestChatHistory(Number(roomId), 50, 0);
      } else {
        console.warn("Socket not connected — chat history not requested");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (!newMessage.trim() || !roomId || isSending || !isConnected) return;

    setIsSending(true);
    try {
      // No optimistic local add — the server broadcasts back to the sender too,
      // so we rely on the single `message-received` event for consistency.
      socketService.sendMessage(Number(roomId), newMessage.trim());
      setNewMessage("");
    } finally {
      // Always re-enable sending so the input never stays locked
      setTimeout(() => setIsSending(false), 300);
    }
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 glass-dark border-l border-border animate-slide-up z-30 flex flex-col">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold">In-meeting Chat</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-2">
          <div className="space-y-4 pb-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.isMe ? "items-end" : "items-start"}`}
                >
                  {!message.isMe && (
                    <span className="text-xs text-muted-foreground mb-1 ml-1">
                      {message.sender}
                    </span>
                  )}
                  <div
                    className={`group relative max-w-[85%] px-4 py-2.5 rounded-2xl ${
                      message.isMe
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-foreground rounded-bl-sm"
                    }`}
                  >
                    <p className="text-sm leading-relaxed break-words">{message.content}</p>
                    <button className="absolute -right-1 top-1/2 -translate-y-1/2 p-1 rounded-md bg-accent/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 mx-1">
                    {message.timestamp}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border flex-shrink-0 space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={!isConnected || isSending}
              className="bg-secondary border-0"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newMessage.trim() || !isConnected || isSending}
              title="Send message (Enter)"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Press Enter to send</p>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;