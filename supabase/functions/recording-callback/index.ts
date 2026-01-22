import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Webhook handler for Africa's Talking call recording callbacks
 * 
 * Africa's Talking sends recording URLs that expire after 24-48 hours.
 * This function:
 * 1. Receives the recording callback
 * 2. Downloads the recording file
 * 3. Uploads to permanent storage (Supabase Storage)
 * 4. Triggers transcription
 * 5. Updates call record with recording URL
 */

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        console.log("[Recording Callback] Received recording notification");

        // Parse callback data (Africa's Talking sends form-urlencoded)
        const contentType = req.headers.get("content-type") || "";
        let params: any = {};

        if (contentType.includes("application/x-www-form-urlencoded")) {
            const bodyText = await req.text();
            const searchParams = new URLSearchParams(bodyText);
            params = Object.fromEntries(searchParams.entries());
        } else {
            params = await req.json();
        }

        console.log("[Recording Callback] Parameters:", JSON.stringify(params, null, 2));

        const {
            sessionId,
            recordingUrl,
            durationInSeconds,
            callStartTime,
            isActive,
            status
        } = params;

        if (!sessionId || !recordingUrl) {
            throw new Error("Missing required parameters: sessionId or recordingUrl");
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Find the call record by session ID
        const { data: callRecord, error: findError } = await supabase
            .from("telemarketing_calls")
            .select("id, lead_id")
            .eq("call_id", sessionId)
            .maybeSingle();

        if (findError) {
            console.error("[Recording Callback] Error finding call:", findError);
            // Try alternative: find in call_activities table
            const { data: activityRecord } = await supabase
                .from("call_activities")
                .select("id")
                .ilike("notes", `%session:${sessionId}%`)
                .maybeSingle();

            if (activityRecord) {
                console.log("[Recording Callback] Found call in call_activities:", activityRecord.id);
            }
        }

        console.log("[Recording Callback] Found call record:", callRecord?.id);

        // Download the recording from Africa's Talking
        console.log("[Recording Callback] Downloading recording from:", recordingUrl);
        const recordingResponse = await fetch(recordingUrl);

        if (!recordingResponse.ok) {
            throw new Error(`Failed to download recording: ${recordingResponse.status}`);
        }

        const recordingBlob = await recordingResponse.blob();
        const recordingBuffer = await recordingBlob.arrayBuffer();
        console.log("[Recording Callback] Downloaded recording, size:", recordingBuffer.byteLength, "bytes");

        // Upload to Supabase Storage
        const fileName = `recordings/${sessionId}_${Date.now()}.mp3`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("call-recordings")
            .upload(fileName, recordingBuffer, {
                contentType: "audio/mpeg",
                upsert: false
            });

        if (uploadError) {
            console.error("[Recording Callback] Upload error:", uploadError);
            throw new Error(`Failed to upload recording: ${uploadError.message}`);
        }

        console.log("[Recording Callback] Uploaded to storage:", uploadData.path);

        // Get public URL for the recording
        const { data: publicUrlData } = supabase.storage
            .from("call-recordings")
            .getPublicUrl(fileName);

        const permanentUrl = publicUrlData.publicUrl;
        console.log("[Recording Callback] Permanent URL:", permanentUrl);

        // Update call record with recording URLs
        if (callRecord) {
            const { error: updateError } = await supabase
                .from("telemarketing_calls")
                .update({
                    recording_url: recordingUrl, // Original (temporary) URL
                    audio_uri: permanentUrl,      // Permanent storage URL
                    duration_seconds: durationInSeconds ? parseInt(durationInSeconds) : null
                })
                .eq("id", callRecord.id);

            if (updateError) {
                console.error("[Recording Callback] Error updating call record:", updateError);
            } else {
                console.log("[Recording Callback] Updated call record with recording URLs");
            }

            // Trigger transcription (async - don't wait for it)
            console.log("[Recording Callback] Triggering transcription...");
            fetch(`${supabaseUrl}/functions/v1/transcribe-recording`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({
                    callId: callRecord.id,
                    audioUrl: permanentUrl,
                    sessionId: sessionId
                })
            }).catch(err => {
                console.error("[Recording Callback] Error triggering transcription:", err);
            });
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Recording processed successfully",
                recording_url: permanentUrl
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[Recording Callback] Error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});
