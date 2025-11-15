import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoTimestamp = sevenDaysAgo.getTime();

    console.log('Cleaning up voice messages older than:', sevenDaysAgo.toISOString());

    // List all files in the whatsapp-media bucket
    const { data: files, error: listError } = await supabase.storage
      .from('whatsapp-media')
      .list('incoming', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (listError) {
      console.error('Error listing files:', listError);
      throw listError;
    }

    console.log(`Found ${files?.length || 0} files in storage`);

    // Filter files older than 7 days and delete them
    const filesToDelete: string[] = [];
    
    for (const file of files || []) {
      const fileCreatedAt = new Date(file.created_at).getTime();
      
      if (fileCreatedAt < sevenDaysAgoTimestamp) {
        filesToDelete.push(`incoming/${file.name}`);
      }
    }

    console.log(`Deleting ${filesToDelete.length} files older than 7 days`);

    if (filesToDelete.length > 0) {
      const { data: deleteData, error: deleteError } = await supabase.storage
        .from('whatsapp-media')
        .remove(filesToDelete);

      if (deleteError) {
        console.error('Error deleting files:', deleteError);
        throw deleteError;
      }

      console.log('Successfully deleted old voice messages:', deleteData);
    }

    // Also clean up database records pointing to deleted files
    const { error: dbError } = await supabase
      .from('whatsapp_messages')
      .update({ media_url: null, media_type: null })
      .lt('timestamp', sevenDaysAgo.toISOString())
      .not('media_url', 'is', null);

    if (dbError) {
      console.error('Error updating database records:', dbError);
      // Don't throw, just log - files are already deleted
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Old voice messages cleaned up successfully',
        filesDeleted: filesToDelete.length,
        cutoffDate: sevenDaysAgo.toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in cleanup-old-voice-messages function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
