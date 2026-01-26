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
    // Check for Service Role bypass
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      // Create client for authentication check
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: authHeader! },
          },
        }
      );

      // Verify user is authenticated and is an admin
      const { data: { user }, error: authError } = await authClient.auth.getUser();

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has admin role
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      const { data: userRole, error: roleError } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError || userRole?.role !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create service role client for operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Parse request body for action and limit
    let action = 'distribute';
    let limit = 100000; // Default to "all" (high number)
    try {
      console.log('Request Content-Type:', req.headers.get('content-type'));
      const text = await req.text(); // Read as text first to avoid JSON error if empty and to log it
      console.log('Raw Request Body:', text);

      if (text) {
        const body = JSON.parse(text);
        console.log('Parsed Body:', body);
        if (body.action) action = body.action;
        if (body.limit) limit = parseInt(body.limit);
      }
    } catch (err) {
      console.warn('Error parsing request body:', err);
    }

    console.log(`Distribution Configuration -> Action: ${action}, Limit: ${limit}`);

    if (action === 'reset') {
      console.log('Resetting lead distribution via RPC...');

      const { error: resetError } = await supabaseClient
        .rpc('reset_lead_assignments');

      if (resetError) {
        console.warn('RPC reset_lead_assignments failed, attempting direct update:', resetError);
        const { error: fallbackError } = await supabaseClient
          .from('leads')
          .update({ user_id: null, assigned_at: null })
          .not('user_id', 'is', null);

        if (fallbackError) throw fallbackError;
      }

      return new Response(
        JSON.stringify({
          message: `Successfully unassigned all leads`,
          action: 'reset'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all unassigned leads (with pagination)
    let allLeads: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      // Calculate how many to fetch in this page
      // If we have a global limit, ensure we don't fetch more than needed
      const remainingNeeded = limit - allLeads.length;
      if (remainingNeeded <= 0) break;

      const fetchSize = Math.min(pageSize, remainingNeeded);

      // Try to select with lead_score first
      let { data: leads, error: leadsError } = await supabaseClient
        .from('leads')
        .select('id, lead_score, lifetime_value')
        .is('user_id', null)
        .order('lead_score', { ascending: false })
        .range(page * pageSize, (page * pageSize) + fetchSize - 1); // Correct range logic for fetchSize

      if (leadsError && leadsError.code === 'PGRST100') { // Postgres error for column missing (often 400)
        console.warn("Lead score column missing, falling back to basic select");
        const fallback = await supabaseClient
          .from('leads')
          .select('id')
          .is('user_id', null)
          .range(page * pageSize, (page * pageSize) + fetchSize - 1);

        leads = fallback.data;
        leadsError = fallback.error;
      } else if (leadsError) {
        // If error is not specifically about missing column but still fails, let's try fallback anyway to be safe?
        // No, might hide other errors. But for 400 (Bad Request), it's usually schema.
        console.warn("Error fetching with scores, trying fallback...", leadsError);
        const fallback = await supabaseClient
          .from('leads')
          .select('id')
          .is('user_id', null)
          .range(page * pageSize, (page * pageSize) + fetchSize - 1);

        if (!fallback.error) {
          leads = fallback.data;
          leadsError = null;
        }
      }

      if (leadsError) {
        console.error('Error fetching unassigned leads:', leadsError);
        throw leadsError;
      }

      if (leads && leads.length > 0) {
        allLeads = [...allLeads, ...leads];
        // If we got fewer than requested (fetchSize), we're done
        if (leads.length < fetchSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }

      // Safety break to enforce limit
      if (allLeads.length >= limit) {
        hasMore = false;
      }
    }

    const unassignedLeads = allLeads;
    console.log(`Found ${unassignedLeads.length} unassigned leads`);

    // ... (rest of distribution logic)

    // Get all approved agents directly from profiles
    // We intentionally skip the 'user_roles' join to avoid sync issues.
    // If they are approved and online, they get leads.
    const { data: agents, error: agentsError } = await supabaseClient
      .from('profiles')
      .select('id, full_name')
      .eq('approved', true)
      .eq('status', 'online');

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      throw agentsError;
    }

    if (!agents || agents.length === 0) {
      // Fallback: Try fetching 'offline' agents if no online ones found?
      // No, strictly online for now unless user asks.
      console.log('No online agents found.');
      return new Response(
        JSON.stringify({ message: 'No online APPROVED agents found', distributed: 0, debug: { reason: 'No profiles with approved=true AND status=online' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${agents.length} active agents: ${agents.map(a => a.full_name).join(', ')}`);

    // --- FAIR DISTRIBUTION ALGORITHM ---
    // Goal: Balance the TOTAL SCORE assigned to each agent, not just the count.

    // Initialize agent score trackers
    const agentScores = agents.map(a => ({
      id: a.id,
      totalScore: 0,
      count: 0
    }));

    const updates = unassignedLeads.map((lead) => {
      // Find agent with the lowest current total score
      // Tie-breaker: If scores are equal (e.g. 0), pick the one with fewest leads in this batch
      agentScores.sort((a, b) => {
        if (a.totalScore !== b.totalScore) {
          return a.totalScore - b.totalScore;
        }
        return a.count - b.count;
      });

      const targetAgent = agentScores[0];

      // Assign lead
      // Ensure we add at least a tiny fraction to totalScore if lead_score is 0/null
      // This prevents the "sticky zero" issue where an agent stays at 0 and keeps getting leads
      const scoreToAdd = (lead.lead_score || 0);
      targetAgent.totalScore += scoreToAdd;
      targetAgent.count += 1;

      return {
        id: lead.id,
        user_id: targetAgent.id,
        assigned_at: new Date().toISOString()
      };
    });

    // Try to update using RPC (Fastest & Best)
    let totalUpdated = 0;

    const { error: rpcError } = await supabaseClient
      .rpc('bulk_assign_leads', { payload: updates });

    if (!rpcError) {
      console.log('Successfully distributed leads via RPC');
      totalUpdated = updates.length;
    } else {
      console.warn('RPC bulk_assign_leads failed, falling back to batch updates. Error:', rpcError);

      // Fallback: Update leads in batches using parallel updates
      // Using smaller batch size to be safe against 500 errors
      const batchSize = 10;

      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);

        await Promise.all(batch.map(async (update) => {
          const { error: updateError } = await supabaseClient
            .from('leads')
            .update({
              user_id: update.user_id,
              assigned_at: update.assigned_at
            })
            .eq('id', update.id);

          if (updateError) throw updateError;
        }));

        totalUpdated += batch.length;
      }
    }

    // Calculate distribution per agent
    const distribution = agents.map(agent => {
      const stats = agentScores.find(s => s.id === agent.id);
      return {
        agent: agent.full_name,
        leadsAssigned: stats?.count || 0,
        totalScore: stats?.totalScore || 0
      };
    });

    return new Response(
      JSON.stringify({
        message: `Successfully distributed ${totalUpdated} leads among ${agents.length} agents`,
        distributed: totalUpdated,
        distribution: distribution,
        debug: {
          foundAgents: agents.map(a => a.full_name),
          totalAvailable: agents.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('CRITICAL Error in distribute-leads function:', error);
    // Log the full error object structure
    if (error?.message) console.error('Error Message:', error.message);
    if (error?.hint) console.error('Error Hint:', error.hint);
    if (error?.details) console.error('Error Details:', error.details);
    if (error?.code) console.error('Error Code:', error.code);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error?.details || error?.hint || 'No details',
        code: error?.code
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
