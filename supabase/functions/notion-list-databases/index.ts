
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
    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error("Missing required parameter: userId");
    }
    
    console.log(`Processing database request for userId: ${userId}`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the Notion access token from the database
    const { data: connectionData, error: connectionError } = await supabase
      .from('notion_connections')
      .select('access_token, workspace_name')
      .eq('user_id', userId)
      .single();
    
    if (connectionError || !connectionData) {
      console.error("Error fetching Notion connection:", connectionError);
      throw new Error("Notion connection not found");
    }
    
    const accessToken = connectionData.access_token;
    const workspaceName = connectionData.workspace_name || "Notion Workspace";
    
    // Fetch databases from Notion with the search API
    const searchParams = {
      filter: {
        value: 'database',
        property: 'object'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      },
      page_size: 100
    };
    
    console.log("Fetching databases from Notion API");
    
    // Log the request we're about to make
    console.log("Notion API request:", {
      url: 'https://api.notion.com/v1/search',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer [REDACTED]',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(searchParams),
    });
    
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchParams),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Notion API error:", errorData);
      throw new Error(`Notion API error: ${errorData.message || 'Unknown error'}`);
    }
    
    const searchResults = await response.json();
    
    // Log the raw response for debugging
    console.log(`Notion API raw response status: ${response.status}`);
    console.log(`Retrieved ${searchResults.results?.length || 0} databases from Notion API`);
    
    if (!searchResults.results || searchResults.results.length === 0) {
      console.log("No databases found in Notion workspace");
      // Try listing users to see permissions
      try {
        const usersResponse = await fetch('https://api.notion.com/v1/users', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Notion-Version': '2022-06-28',
          },
        });
        
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          console.log(`Found ${usersData.results?.length || 0} users in workspace`);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    }
    
    // Process databases to extract useful information
    const databases = searchResults.results ? searchResults.results.map((db: any) => {
      // Extract database title
      let title = 'Untitled Database';
      if (db.title && Array.isArray(db.title)) {
        title = db.title.map((t: any) => t.plain_text).join('');
      }
      
      // Extract database icon
      let icon = null;
      if (db.icon) {
        icon = db.icon.type === 'emoji' ? db.icon.emoji : 
              (db.icon.type === 'external' ? db.icon.external.url : null);
      }
      
      return {
        id: db.id,
        title: title,
        url: db.url,
        icon: icon,
        created_time: db.created_time,
        last_edited_time: db.last_edited_time,
      };
    }) : [];
    
    return new Response(
      JSON.stringify({
        success: true,
        databases: databases,
        workspace_name: workspaceName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in notion-list-databases function:", error);
    
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
