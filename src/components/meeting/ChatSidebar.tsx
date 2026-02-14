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
}

const ChatSidebar = ({ isOpen, onClose, roomId = "", username = "Anonymous" }: ChatSidebarProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Set up chat message listeners
  useEffect(() => {
    const handleChatMessage = (data: any) => {
      const newMsg: Message = {
        id: data.id?.toString() || Date.now().toString(),
        sender: data.userName || "Unknown",
        content: data.content || "",
        timestamp: new Date(data.created_at || Date.now()).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isMe: data.userName === username
      };
      
      setMessages(prev => [...prev, newMsg]);
    };

    // Subscribe to message-received event
    const unsubscribe = socketService.on('message-received', handleChatMessage);

    // ✅ FIXED: Request chat history with delay to ensure socket is connected
    if (roomId) {
      // Wait 1 second for socket to connect
      const timer = setTimeout(() => {
        if (socketService.isSocketConnected()) {
          socketService.requestChatHistory(Number(roomId), 50, 0);
        } else {
          console.warn('Socket not connected, chat history not requested');
        }
      }, 1000);

      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    }

    return () => {
      unsubscribe();
    };
  }, [roomId, username]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (newMessage.trim() && roomId) {
      // Send message using socket service
      socketService.sendMessage(Number(roomId), newMessage.trim());
      
      // Add to local messages immediately for instant feedback
      const localMessage: Message = {
        id: Date.now().toString(),
        sender: username,
        content: newMessage.trim(),
        timestamp: new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        isMe: true
      };
      setMessages(prev => [...prev, localMessage]);
      
      setNewMessage("");
    }
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 glass-dark border-l border-border animate-slide-up z-10 flex flex-col">
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
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={!roomId}
              className="bg-secondary border-0"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newMessage.trim() || !roomId}
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