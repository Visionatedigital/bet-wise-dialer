import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

// The trusted list of agent names from the user
const TRUSTED_AGENTS = [
    "hamza rehemaah",
    "lakot caroline okello",
    "mushakamba kabahizi shadrak",
    "nabulya betty",
    "nakitende tifan",
    "nalugwa bridget",
    "nambogo nashibah",
    "regina arionget",
    "sheebah mushakamba"
];

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        if (!supabaseServiceKey) {
            throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log("Starting agent role enforcement...");
        const logs: string[] = [];
        const log = (msg: string) => {
            console.log(msg);
            logs.push(msg);
        };

        // 1. Get all users
        const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
        if (usersError) throw usersError;

        log(`Found ${users.length} total users`);

        let rolesAssigned = 0;
        let rolesRemoved = 0;

        // 2. Process each user
        for (const user of users) {
            // Get profile to check name
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", user.id)
                .single();

            const fullName = profile?.full_name || user.user_metadata?.full_name || "";
            // Normalize whitespace: replace multiple spaces with single space, trim
            const normalizedName = fullName.toLowerCase().replace(/\s+/g, ' ').trim();

            const isTrustedAgent = TRUSTED_AGENTS.some(agent => normalizedName.includes(agent));

            if (isTrustedAgent) {
                log(`MATCH: "${fullName}" matches trusted agent`);

                // Ensure has agent role
                const { data: role } = await supabase
                    .from("user_roles")
                    .select("*")
                    .eq("user_id", user.id)
                    .eq("role", "agent")
                    .single();

                if (!role) {
                    const { error: assignError } = await supabase.from("user_roles").insert({
                        user_id: user.id,
                        role: "agent"
                    });
                    if (assignError) {
                        log(`  Error assigning role: ${assignError.message}`);
                    } else {
                        log(`  ✅ Assigned agent role`);
                        rolesAssigned++;
                    }
                } else {
                    log(`  ✓ Already has role`);
                }

            } else {
                // user is NOT in trusted list, ensure they DO NOT have agent role
                const { data: role } = await supabase
                    .from("user_roles")
                    .select("*")
                    .eq("user_id", user.id)
                    .eq("role", "agent")
                    .single();

                if (role) {
                    const { error: removeError } = await supabase
                        .from("user_roles")
                        .delete()
                        .eq("user_id", user.id)
                        .eq("role", "agent");

                    if (removeError) {
                        log(`  Error removing role from ${fullName}: ${removeError.message}`);
                    } else {
                        log(`  🗑️ Removed agent role from ${fullName} (normalized: "${normalizedName}")`);
                        rolesRemoved++;
                    }
                }
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                summary: `Assigned ${rolesAssigned} roles, Removed ${rolesRemoved} roles`,
                logs,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
