import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { SmilePlus } from 'lucide-react';

const EMOJI_REACTIONS = ['👍', '😂', '❤️', '👏', '🎉', '😲', '🙏', '🔥'];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  isLoading?: boolean;
}

/**
 * Emoji picker popover component (Google Meet style)
 * Displays available emoji reactions for quick selection
 * 
 * Features:
 * - 8 popular emoji reactions
 * - Smooth hover animations
 * - Popover positioned above button
 * - Touch-friendly sizing
 */
const EmojiPicker = ({ onEmojiSelect, isLoading = false }: EmojiPickerProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="control" 
          size="control"
          disabled={isLoading}
          title="Send emoji reaction"
        >
          <SmilePlus className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800" side="top" align="center">
        <div className="flex items-center gap-3">
          {EMOJI_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onEmojiSelect(emoji);
              }}
              disabled={isLoading}
              className="text-2xl hover:scale-125 transition-transform duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-lg p-1"
              title={`React with ${emoji}`}
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
          Click emoji to react
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
