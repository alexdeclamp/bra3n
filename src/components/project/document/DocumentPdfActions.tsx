
import React from 'react';
import { Eye, MessageSquare, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DocumentPdfActionsProps {
  onGenerateSummary: () => void;
  isGenerating: boolean;
  onChatClick: () => void;
  onAskQuestion: () => void;
}

const DocumentPdfActions: React.FC<DocumentPdfActionsProps> = ({
  onGenerateSummary,
  isGenerating,
  onChatClick,
  onAskQuestion
}) => {
  const handleDisabledFeatureClick = () => {
    toast.info("This feature is currently disabled");
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        className="flex items-center gap-1"
        onClick={onGenerateSummary}
        disabled={isGenerating}
      >
        <Eye className="h-4 w-4" />
        <span className="hidden sm:inline">Summarize</span>
      </Button>
      
      <Button 
        variant="outline" 
        size="sm" 
        className="flex items-center gap-1"
        onClick={handleDisabledFeatureClick}
        disabled={true}
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Ask Question</span>
      </Button>
      
      <Button 
        variant="default" 
        size="sm" 
        className="flex items-center gap-1"
        onClick={handleDisabledFeatureClick}
        disabled={true}
      >
        <MessageSquare className="h-4 w-4" />
        <span className="sm:inline">Chat</span>
      </Button>
    </>
  );
};

export default DocumentPdfActions;
