import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import SummaryDialog from './SummaryDialog';
import { useParams } from 'react-router-dom';

interface NoteSummaryButtonProps {
  noteId: string;
  noteTitle: string;
  noteContent: string | null;
}

const NoteSummaryButton: React.FC<NoteSummaryButtonProps> = ({
  noteId,
  noteTitle,
  noteContent
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { id: projectId } = useParams<{ id: string }>();
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  useEffect(() => {
    const fetchSavedSummary = async () => {
      if (!noteId || !projectId) return;
      
      try {
        setIsLoadingSaved(true);
        console.log('Fetching saved summary for note:', noteId);
        
        const { data, error } = await supabase
          .from('note_summaries')
          .select('summary')
          .eq('note_id', noteId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching saved summary:', error.message);
          return;
        }
        
        if (data?.summary) {
          console.log('Found saved summary for note:', noteId);
          setSavedSummary(data.summary);
          setSummary(data.summary);
        } else {
          console.log('No saved summary found for note:', noteId);
          setSavedSummary(null);
          setSummary('');
        }
      } catch (error) {
        console.error('Error fetching saved summary:', error);
      } finally {
        setIsLoadingSaved(false);
      }
    };
    
    fetchSavedSummary();
  }, [noteId, projectId]);

  const generateSummary = async () => {
    if (!noteContent) {
      toast.error('Cannot generate summary for empty note content');
      return;
    }

    if (!projectId) {
      toast.error('Project ID is required for generating summaries');
      return;
    }

    try {
      setIsGenerating(true);
      setIsDialogOpen(true);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error('You must be logged in to generate summaries');
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('generate-summary', {
        body: {
          type: 'note',
          content: noteContent,
          projectId,
          userId: user.user.id,
          noteId,
        },
      });

      if (error) {
        console.error('Error from generate-summary function:', error);
        throw error;
      }
      
      if (!data || !data.summary) {
        throw new Error('Received empty or invalid response from the summary generator');
      }
      
      setSummary(data.summary);
      setSavedSummary(data.summary);
    } catch (error: any) {
      console.error('Error generating summary:', error);
      toast.error(`Failed to generate summary: ${error.message || 'Unknown error'}`);
      if (!savedSummary) {
        setIsDialogOpen(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        onClick={generateSummary}
        disabled={isGenerating || !noteContent}
        title={savedSummary ? "View Saved AI Summary" : "Generate AI Summary"}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" /> 
        ) : savedSummary ? (
          <FileText className="h-4 w-4 text-blue-500" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )}
      </Button>

      <SummaryDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={`Summary of "${noteTitle}"`}
        summary={summary}
        isLoading={isGenerating && !savedSummary}
        hasSavedVersion={!!savedSummary}
      />
    </>
  );
};

export default NoteSummaryButton;
