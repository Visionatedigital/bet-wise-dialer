import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Multi-language transcription service
 * Supports: English, Luganda, Kiswahili, Runyankole
 * 
 * Uses Google Cloud Speech-to-Text for best multi-language support
 * Falls back to OpenAI Whisper for unsupported languages
 */

interface TranscriptionRequest {
    callId: string;
    audioUrl: string;
    sessionId?: string;
    languageHint?: string; // 'en', 'sw', 'lg', 'nyn'
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { callId, audioUrl, sessionId, languageHint }: TranscriptionRequest = await req.json();

        if (!callId || !audioUrl) {
            throw new Error("callId and audioUrl are required");
        }

        console.log(`[Transcription] Processing call ${callId}, audio: ${audioUrl}`);

        // Initialize Supabase
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Download audio file
        console.log("[Transcription] Downloading audio file...");
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            throw new Error(`Failed to download audio: ${audioResponse.status}`);
        }

        const audioBlob = await audioResponse.blob();
        const audioBuffer = await audioBlob.arrayBuffer();
        const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

        console.log("[Transcription] Audio downloaded, size:", audioBuffer.byteLength, "bytes");

        // Try Google Cloud Speech-to-Text first (better for African languages)
        const googleApiKey = Deno.env.get("GOOGLE_CLOUD_API_KEY");
        let transcript = "";
        let detectedLanguage = languageHint || "en";

        if (googleApiKey) {
            try {
                console.log("[Transcription] Using Google Cloud Speech-to-Text");
                const googleResult = await transcribeWithGoogle(audioBase64, languageHint, googleApiKey);
                transcript = googleResult.transcript;
                detectedLanguage = googleResult.language;
            } catch (googleError) {
                console.error("[Transcription] Google API failed, falling back to Whisper:", googleError);
                // Fall back to Whisper
                transcript = await transcribeWithWhisper(audioBuffer);
            }
        } else {
            // Use OpenAI Whisper as default
            console.log("[Transcription] Using OpenAI Whisper");
            transcript = await transcribeWithWhisper(audioBuffer);
        }

        console.log("[Transcription] Transcript generated, length:", transcript.length);
        console.log("[Transcription] First 200 chars:", transcript.substring(0, 200));

        // Update call record with transcript
        const { error: updateError } = await supabase
            .from("telemarketing_calls")
            .update({
                // Note: We need to add a transcript column to telemarketing_calls table
                // For now, we'll store it in a JSON field or create the column
            })
            .eq("id", callId);

        if (updateError) {
            console.error("[Transcription] Error updating call:", updateError);
        }

        // Also update call_activities if exists
        if (sessionId) {
            await supabase
                .from("call_activities")
                .update({ transcript: transcript })
                .ilike("notes", `%session:${sessionId}%`);
        }

        // Trigger AI analysis
        console.log("[Transcription] Triggering AI analysis...");
        fetch(`${supabaseUrl}/functions/v1/analyze-call-recording`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
                callId: callId,
                transcript: transcript,
                language: detectedLanguage
            })
        }).catch(err => {
            console.error("[Transcription] Error triggering AI analysis:", err);
        });

        return new Response(
            JSON.stringify({
                success: true,
                transcript: transcript,
                language: detectedLanguage,
                length: transcript.length
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[Transcription] Error:", error);
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

async function transcribeWithGoogle(
    audioBase64: string,
    languageHint: string | undefined,
    apiKey: string
): Promise<{ transcript: string; language: string }> {
    // Map language codes to Google Cloud language codes
    const languageMap: Record<string, string> = {
        'en': 'en-US',
        'sw': 'sw-KE', // Swahili (Kenya/Tanzania)
        'lg': 'lg-UG', // Luganda (Uganda) - may not be supported
        'nyn': 'en-US' // Runyankole - fallback to English
    };

    const googleLanguage = languageMap[languageHint || 'en'] || 'en-US';

    const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                config: {
                    encoding: "MP3",
                    sampleRateHertz: 16000,
                    languageCode: googleLanguage,
                    alternativeLanguageCodes: ["en-US", "sw-KE"], // Enable multi-language
                    enableAutomaticPunctuation: true,
                    enableWordTimeOffsets: false,
                    model: "phone_call" // Optimized for phone calls
                },
                audio: {
                    content: audioBase64
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Speech API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
        throw new Error("No transcription results from Google");
    }

    const transcript = data.results
        .map((result: any) => result.alternatives[0].transcript)
        .join(" ");

    return {
        transcript,
        language: data.results[0]?.languageCode || googleLanguage
    };
}

async function transcribeWithWhisper(audioBuffer: ArrayBuffer): Promise<string> {
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
        throw new Error("OpenAI API key not configured");
    }

    // Create form data for Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
    formData.append("file", audioBlob, "audio.mp3");
    formData.append("model", "whisper-1");
    formData.append("language", "en"); // Whisper will auto-detect if wrong
    formData.append("response_format", "text");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${openAIApiKey}`
        },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }

    const transcript = await response.text();
    return transcript;
}
