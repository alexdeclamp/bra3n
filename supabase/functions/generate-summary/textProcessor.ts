
import { openAIApiKey, corsHeaders } from "./utils.ts";

// Define summary prompt directly in the function instead of importing
const summaryPrompt = `You are an expert BCG consultant summarizing business documents in a structured format.
Be concise, data-driven, and focus on actionable insights with a strategic perspective.

Create summaries with these specific sections:

1. Executive Summary: A brief 2-3 sentence overview highlighting the core strategic message and business implications
2. Description: A clear explanation of the content and its business context without unnecessary details
3. Key Learning Points: The critical strategic insights from the document, presented as focused bullet points
4. Warnings: Any potential risks, challenges, or red flags that should be considered (if relevant, otherwise omit)
5. Next Steps: Recommended actions and strategic priorities based on this information (if relevant)

FORMAT YOUR SUMMARY AS CLEAN MARKDOWN with these exact section headings. Maintain a professional, consulting tone throughout.`;

// Process and summarize text content using OpenAI's API
export async function processText(content: string): Promise<string> {
  try {
    console.log('Content length:', content.length);
    
    // Set up messages for OpenAI for text summarization with structured format
    const messages = [
      {
        role: 'system',
        content: summaryPrompt
      },
      {
        role: 'user',
        content: `Please summarize the following note: ${content}`
      }
    ];
    
    // Call OpenAI API to summarize the text
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error processing text:', error);
    throw new Error(`Error processing text: ${error.message}`);
  }
}
