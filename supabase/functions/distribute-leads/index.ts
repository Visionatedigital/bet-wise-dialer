import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get all unassigned leads
    const { data: unassignedLeads, error: leadsError } = await supabaseClient
      .from('leads')
      .select('id')
      .is('user_id', null);

    if (leadsError) throw leadsError;

    if (!unassignedLeads || unassignedLeads.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unassigned leads to distribute', distributed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all approved agents with 'agent' role and status 'online' or 'offline'
    const { data: agentRoles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'agent');

    if (rolesError) throw rolesError;

    const agentIds = agentRoles?.map(r => r.user_id) || [];

    if (agentIds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No agents available for lead distribution', distributed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: agents, error: agentsError } = await supabaseClient
      .from('profiles')
      .select('id, full_name')
      .in('id', agentIds)
      .eq('approved', true);

    if (agentsError) throw agentsError;

    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No approved agents available', distributed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Distribute leads equally using round-robin
    const updates = unassignedLeads.map((lead, index) => {
      const agentIndex = index % agents.length;
      const agent = agents[agentIndex];
      return {
        id: lead.id,
        user_id: agent.id,
        assigned_at: new Date().toISOString()
      };
    });

    // Update leads in batches
    const batchSize = 100;
    let totalUpdated = 0;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      for (const update of batch) {
        const { error: updateError } = await supabaseClient
          .from('leads')
          .update({ 
            user_id: update.user_id,
            assigned_at: update.assigned_at
          })
          .eq('id', update.id);

        if (!updateError) {
          totalUpdated++;
        }
      }
    }

    // Calculate distribution per agent
    const distribution = agents.map(agent => {
      const count = updates.filter(u => u.user_id === agent.id).length;
      return {
        agent: agent.full_name,
        leadsAssigned: count
      };
    });

    return new Response(
      JSON.stringify({
        message: `Successfully distributed ${totalUpdated} leads among ${agents.length} agents`,
        distributed: totalUpdated,
        distribution: distribution
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in distribute-leads function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
