
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, pageId, projectId } = await req.json();
    
    if (!userId || !pageId || !projectId) {
      throw new Error("Missing required parameters: userId, pageId, and projectId");
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify the project exists and user has access to it
    const { data: projectAccess, error: projectError } = await supabase.rpc(
      'is_project_member',
      { project_id: projectId, user_id: userId }
    );
    
    const { data: projectOwner, error: ownerError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();
      
    if ((projectError && ownerError) || (!projectAccess && projectOwner?.owner_id !== userId)) {
      throw new Error("You don't have access to this project");
    }
    
    // Get the Notion access token from the database
    const { data: connectionData, error: connectionError } = await supabase
      .from('notion_connections')
      .select('access_token')
      .eq('user_id', userId)
      .single();
    
    if (connectionError || !connectionData) {
      console.error("Error fetching Notion connection:", connectionError);
      throw new Error("Notion connection not found");
    }
    
    const accessToken = connectionData.access_token;
    
    // Fetch page details from Notion
    const pageResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });
    
    if (!pageResponse.ok) {
      const errorData = await pageResponse.json();
      console.error("Notion API error (page):", errorData);
      throw new Error(`Notion API error: ${errorData.message || 'Unknown error'}`);
    }
    
    const pageData = await pageResponse.json();
    
    // Fetch page content from Notion
    const blockResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });
    
    if (!blockResponse.ok) {
      const errorData = await blockResponse.json();
      console.error("Notion API error (blocks):", errorData);
      throw new Error(`Notion API error: ${errorData.message || 'Unknown error'}`);
    }
    
    const blocksData = await blockResponse.json();
    
    // Improved page title extraction logic
    // First try to get from the standard properties.title
    let pageTitle = '';
    
    // Check if properties.title exists
    if (pageData.properties && pageData.properties.title && 
        pageData.properties.title.title && 
        Array.isArray(pageData.properties.title.title) && 
        pageData.properties.title.title.length > 0) {
      
      pageTitle = pageData.properties.title.title
        .map(textObj => textObj.plain_text)
        .join('');
    }
    // If not found, try properties.Name which is also common
    else if (pageData.properties && pageData.properties.Name && 
             pageData.properties.Name.title && 
             Array.isArray(pageData.properties.Name.title) && 
             pageData.properties.Name.title.length > 0) {
             
      pageTitle = pageData.properties.Name.title
        .map(textObj => textObj.plain_text)
        .join('');
    }
    // If still not found, look for any property that has a title type
    else {
      for (const propKey in pageData.properties) {
        const prop = pageData.properties[propKey];
        if (prop.type === 'title' && prop.title && Array.isArray(prop.title) && prop.title.length > 0) {
          pageTitle = prop.title
            .map(textObj => textObj.plain_text)
            .join('');
          break;
        }
      }
    }
    
    // Fallback if we still couldn't find a title
    if (!pageTitle) {
      // Try to use the first heading or paragraph from content as a title
      for (const block of blocksData.results || []) {
        if (block.type === 'heading_1' && block.heading_1?.rich_text?.[0]?.plain_text) {
          pageTitle = block.heading_1.rich_text.map(t => t.plain_text).join('');
          break;
        } 
        else if (block.type === 'paragraph' && block.paragraph?.rich_text?.[0]?.plain_text) {
          pageTitle = block.paragraph.rich_text.map(t => t.plain_text).join('');
          if (pageTitle.length > 40) {
            pageTitle = pageTitle.substring(0, 40) + '...';
          }
          break;
        }
      }
      
      // Final fallback
      if (!pageTitle) {
        pageTitle = `Notion Page (${new Date().toLocaleDateString()})`;
      }
    }
    
    console.log(`Extracted page title: "${pageTitle}"`);
    
    // Convert blocks to markdown-like format with expanded handling for nested content
    let content = '';
    
    // Recursive function to process nested blocks
    async function processBlocks(blocks, level = 0) {
      let blockContent = '';
      
      for (const block of blocks) {
        // Process the current block based on its type
        blockContent += await processBlock(block, level);
        
        // Check if the block has children
        if (block.has_children) {
          try {
            // Fetch the children blocks
            const childrenResponse = await fetch(`https://api.notion.com/v1/blocks/${block.id}/children`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Notion-Version': '2022-06-28',
              },
            });
            
            if (childrenResponse.ok) {
              const childrenData = await childrenResponse.json();
              // Process the children blocks with an increased level
              blockContent += await processBlocks(childrenData.results, level + 1);
            }
          } catch (err) {
            console.error(`Error fetching children for block ${block.id}:`, err);
            blockContent += `\n\n*[Error loading nested content]*\n\n`;
          }
        }
      }
      
      return blockContent;
    }
    
    // Process a single block
    async function processBlock(block, level = 0) {
      const indent = '  '.repeat(level);
      
      switch (block.type) {
        case 'paragraph':
          if (block.paragraph.rich_text && block.paragraph.rich_text.length > 0) {
            return `${indent}${block.paragraph.rich_text.map((text) => text.plain_text).join('')}\n\n`;
          } else {
            return `${indent}\n\n`;
          }
        case 'heading_1':
          if (block.heading_1.rich_text && block.heading_1.rich_text.length > 0) {
            return `${indent}# ${block.heading_1.rich_text.map((text) => text.plain_text).join('')}\n\n`;
          }
          break;
        case 'heading_2':
          if (block.heading_2.rich_text && block.heading_2.rich_text.length > 0) {
            return `${indent}## ${block.heading_2.rich_text.map((text) => text.plain_text).join('')}\n\n`;
          }
          break;
        case 'heading_3':
          if (block.heading_3.rich_text && block.heading_3.rich_text.length > 0) {
            return `${indent}### ${block.heading_3.rich_text.map((text) => text.plain_text).join('')}\n\n`;
          }
          break;
        case 'bulleted_list_item':
          if (block.bulleted_list_item.rich_text && block.bulleted_list_item.rich_text.length > 0) {
            return `${indent}- ${block.bulleted_list_item.rich_text.map((text) => text.plain_text).join('')}\n`;
          }
          break;
        case 'numbered_list_item':
          if (block.numbered_list_item.rich_text && block.numbered_list_item.rich_text.length > 0) {
            return `${indent}1. ${block.numbered_list_item.rich_text.map((text) => text.plain_text).join('')}\n`;
          }
          break;
        case 'to_do':
          if (block.to_do.rich_text && block.to_do.rich_text.length > 0) {
            const checkbox = block.to_do.checked ? '[x]' : '[ ]';
            return `${indent}- ${checkbox} ${block.to_do.rich_text.map((text) => text.plain_text).join('')}\n`;
          }
          break;
        case 'toggle':
          if (block.toggle.rich_text && block.toggle.rich_text.length > 0) {
            return `${indent}**Toggle: ${block.toggle.rich_text.map((text) => text.plain_text).join('')}**\n\n`;
          }
          break;
        case 'child_page':
          return `${indent}**Child Page: ${block.child_page.title || 'Untitled'}**\n\n`;
        case 'quote':
          if (block.quote.rich_text && block.quote.rich_text.length > 0) {
            return `${indent}> ${block.quote.rich_text.map((text) => text.plain_text).join('')}\n\n`;
          }
          break;
        case 'code':
          if (block.code.rich_text && block.code.rich_text.length > 0) {
            return `${indent}\`\`\`${block.code.language || ''}\n${block.code.rich_text.map((text) => text.plain_text).join('')}\n\`\`\`\n\n`;
          }
          break;
        case 'divider':
          return `${indent}---\n\n`;
        case 'callout':
          if (block.callout.rich_text && block.callout.rich_text.length > 0) {
            const emoji = block.callout.icon?.emoji ? `${block.callout.icon.emoji} ` : '';
            return `${indent}> ${emoji}**Callout:** ${block.callout.rich_text.map((text) => text.plain_text).join('')}\n\n`;
          }
          break;
        case 'table':
          return `${indent}[Table content not fully supported]\n\n`;
        case 'column_list':
          return `${indent}[Column layout not fully supported]\n\n`;
        default:
          return `${indent}[${block.type} block type not supported]\n\n`;
      }
      
      return '';
    }

    // Recursive function to process nested blocks
    async function processBlocks(blocks, level = 0) {
      let blockContent = '';
      
      for (const block of blocks) {
        // Process the current block based on its type
        blockContent += await processBlock(block, level);
        
        // Check if the block has children
        if (block.has_children) {
          try {
            // Fetch the children blocks
            const childrenResponse = await fetch(`https://api.notion.com/v1/blocks/${block.id}/children`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Notion-Version': '2022-06-28',
              },
            });
            
            if (childrenResponse.ok) {
              const childrenData = await childrenResponse.json();
              // Process the children blocks with an increased level
              blockContent += await processBlocks(childrenData.results, level + 1);
            }
          } catch (err) {
            console.error(`Error fetching children for block ${block.id}:`, err);
            blockContent += `\n\n*[Error loading nested content]*\n\n`;
          }
        }
      }
      
      return blockContent;
    }
    
    // Process all the blocks recursively
    let content = await processBlocks(blocksData.results);
    
    // Create a note with the Notion content, using the extracted title
    const { data: noteData, error: noteError } = await supabase
      .from('project_notes')
      .insert({
        title: pageTitle,
        content: content.trim(),
        project_id: projectId,
        user_id: userId,
        tags: ['notion', 'imported', 'notion-import'],
        source_document: {
          type: 'notion',
          url: pageData.url,
          name: pageTitle,
          id: pageId
        }
      })
      .select()
      .single();
    
    if (noteError) {
      console.error("Error creating note:", noteError);
      throw new Error(`Failed to create note: ${noteError.message}`);
    }
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        note: noteData,
        message: `Successfully imported "${pageTitle}" from Notion`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in notion-import-page function:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
