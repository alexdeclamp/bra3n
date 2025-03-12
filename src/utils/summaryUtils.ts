
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SummaryModel = 'claude' | 'openai';

export interface SummarizeTextOptions {
  text: string;
  model?: SummaryModel;
  maxLength?: number;
  title?: string;
  projectId?: string;
}

export async function summarizeText({
  text,
  model = 'claude',
  maxLength = 1500,
  title,
  projectId
}: SummarizeTextOptions): Promise<string> {
  if (!text || text.trim().length === 0) {
    throw new Error('No text provided for summarization');
  }

  try {
    const toastId = toast.info(`Summarizing text using ${model === 'claude' ? 'Claude' : 'OpenAI'}...`, {
      duration: 10000,
    });

    console.log(`Summarizing text with ${model}. Text length: ${text.length} characters`);
    console.log(`Sending to Supabase function with projectId: ${projectId || 'none'}`);

    const { data, error } = await supabase.functions.invoke('summarize-text', {
      body: {
        text: text.slice(0, 100000), // Limit to 100k chars to avoid payload issues
        model,
        maxLength,
        title,
        projectId
      },
    });

    // Dismiss the pending toast
    toast.dismiss(toastId);

    if (error) {
      console.error('Error from summarize-text function:', error);
      toast.error(`Summarization failed: ${error.message || 'Unknown error'}`);
      throw error;
    }

    if (!data || !data.summary) {
      const errorMsg = 'Received empty response from the summarization service';
      console.error(errorMsg);
      toast.error(errorMsg);
      throw new Error(errorMsg);
    }

    toast.success(`Summary generated successfully using ${model === 'claude' ? 'Claude' : 'OpenAI'}`);
    return data.summary;
  } catch (error: any) {
    console.error('Error summarizing text:', error);
    toast.error(`Failed to summarize text: ${error.message || 'Unknown error'}`);
    throw new Error(`Failed to summarize text: ${error.message || 'Unknown error'}`);
  }
}
