import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color: "primary" | "success" | "orange" | "purple";
  onClick?: () => void;
}

const colorClasses = {
  primary: "bg-primary hover:bg-primary/90",
  success: "bg-success hover:bg-success/90",
  orange: "bg-orange-500 hover:bg-orange-500/90",
  purple: "bg-violet-500 hover:bg-violet-500/90",
};

const MeetingActionCard = ({
  icon: Icon,
  title,
  description,
  color,
  onClick,
}: MeetingActionCardProps) => {
  return (
    <div
      onClick={onClick}
      className="meeting-card group cursor-pointer"
    >
      <div
        className={cn(
          "w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110",
          colorClasses[color]
        )}
      >
        <Icon className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
};

export default MeetingActionCard;
