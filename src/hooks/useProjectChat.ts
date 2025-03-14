
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ProjectChatState {
  messages: Message[];
  isLoading: boolean;
  projectData: {
    description: string | null;
    aiPersona: string | null;
  };
}

export function useProjectChat(projectId: string) {
  const [state, setState] = useState<ProjectChatState>({
    messages: [],
    isLoading: false,
    projectData: { description: null, aiPersona: null },
  });
  const { toast } = useToast();
  const { user } = useAuth();

  // Effect to fetch project data when projectId changes
  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('description, ai_persona, title')
          .eq('id', projectId)
          .single();

        if (error) throw error;

        setState(prev => ({
          ...prev,
          projectData: {
            description: data.description,
            aiPersona: data.ai_persona
          }
        }));
        
        console.log(`Loaded project data for: ${data.title} (${projectId})`);
      } catch (error) {
        console.error('Error fetching project data:', error);
      }
    };

    if (projectId) {
      // Reset messages when switching projects
      setState(prev => ({
        ...prev,
        messages: []
      }));
      
      fetchProjectData();
    }
  }, [projectId]);

  const sendMessage = async (messageContent: string) => {
    if (!messageContent.trim() || !user) return;

    // Add user message to the list
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', content: messageContent }],
      isLoading: true
    }));

    try {
      const { data, error } = await supabase.functions.invoke('project-chat', {
        body: {
          projectId,
          message: messageContent,
          userId: user.id,
          description: state.projectData.description,
          aiPersona: state.projectData.aiPersona
        }
      });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'assistant', content: data.response }],
        isLoading: false
      }));
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Predefined questions that are relevant for any project
  const predefinedQuestions = [
    "What's the latest update on this project?",
    "Summarize the project notes",
    "What are the key documents in this project?",
    "Show me recent activity",
    "What's the project status?",
    "What are the important items in this project?",
    "Show me my favorite documents"
  ];

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    predefinedQuestions,
    sendMessage
  };
}
