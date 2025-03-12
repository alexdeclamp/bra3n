
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SendHorizontal, Loader2 } from 'lucide-react';

interface ProjectChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const ProjectChatInput: React.FC<ProjectChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-2 border-t border-border/50 pt-3">
      <div className="flex gap-2 items-end relative">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message here..."
          className="min-h-[80px] focus-visible:ring-primary/30 bg-background resize-none p-4 rounded-xl"
          onKeyDown={handleKeyDown}
        />
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="h-12 w-12 rounded-full flex-shrink-0 shadow-sm"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SendHorizontal className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectChatInput;
