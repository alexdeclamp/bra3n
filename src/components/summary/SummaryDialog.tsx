
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import SummaryDialogHeader from './SummaryDialogHeader';
import SummaryContent from './SummaryContent';
import SummaryFeedback from './SummaryFeedback';
import SummaryActions from './SummaryActions';

interface SummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  summary: string;
  isLoading: boolean;
  hasSavedVersion?: boolean;
  projectId?: string;
  imageName?: string;
}

const SummaryDialog: React.FC<SummaryDialogProps> = ({
  isOpen,
  onClose,
  title,
  summary,
  isLoading,
  hasSavedVersion = false,
  projectId,
  imageName
}) => {
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const { user } = useAuth();
  
  // Reset feedback state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFeedbackGiven(false);
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (!summary) {
      toast.error("No summary available to copy");
      return;
    }
    navigator.clipboard.writeText(summary);
    toast.success('Summary copied to clipboard');
  };

  const handleDownload = () => {
    if (!summary) {
      toast.error("No summary available to download");
      return;
    }
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-summary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Summary downloaded successfully');
  };

  const handleFeedback = (isPositive: boolean) => {
    toast.success(`Thank you for your feedback!`);
    setFeedbackGiven(true);
  };

  const handleCreateNote = async () => {
    if (!summary || !projectId || !user) {
      toast.error("Cannot create note from this summary");
      return;
    }

    try {
      setIsCreatingNote(true);
      
      // Create a note title based on image name or a default
      const noteTitle = imageName 
        ? `Image Description: ${imageName}` 
        : "Image Description";
      
      const { data, error } = await supabase
        .from('project_notes')
        .insert({
          title: noteTitle,
          content: summary,
          project_id: projectId,
          user_id: user.id,
          tags: ['image', 'ai-generated']
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Note created successfully from image description');
      onClose(); // Close the dialog after creating the note
    } catch (error: any) {
      console.error('Error creating note:', error);
      toast.error(`Failed to create note: ${error.message}`);
    } finally {
      setIsCreatingNote(false);
    }
  };

  // Determine if we have a summary available 
  const hasSummary = hasSavedVersion || (!isLoading && summary.trim() !== '');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
        <SummaryDialogHeader 
          title={title} 
          hasSavedVersion={hasSavedVersion} 
          isLoading={isLoading} 
        />
        
        <div className="mt-4 overflow-y-auto flex-grow">
          <SummaryContent 
            isLoading={isLoading} 
            summary={summary} 
            hasSummary={hasSummary} 
          />
        </div>
        
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2 mt-4">
          <div className="flex items-center space-x-2 mt-4 sm:mt-0">
            {!isLoading && hasSavedVersion && !feedbackGiven && (
              <SummaryFeedback 
                feedbackGiven={feedbackGiven} 
                onFeedback={handleFeedback} 
              />
            )}
            {feedbackGiven && (
              <p className="text-sm text-muted-foreground">Thanks for your feedback!</p>
            )}
          </div>
          
          <SummaryActions 
            summary={summary}
            onCopy={handleCopy}
            onDownload={handleDownload}
            onCreateNote={handleCreateNote}
            isCreatingNote={isCreatingNote}
            projectId={projectId}
            hasSummary={hasSummary}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SummaryDialog;
