import { Calendar, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpcomingMeetingCardProps {
  title: string;
  time: string;
  date: string;
  participants: number;
  isLive?: boolean;
}

const UpcomingMeetingCard = ({
  title,
  time,
  date,
  participants,
  isLive = false,
}: UpcomingMeetingCardProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-foreground">{title}</h4>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {time}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {date}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          {participants} participants
        </span>
        <Button size="sm" variant={isLive ? "default" : "secondary"}>
          {isLive ? "Join Now" : "Start"}
        </Button>
      </div>
    </div>
  );
};

export default UpcomingMeetingCard;
