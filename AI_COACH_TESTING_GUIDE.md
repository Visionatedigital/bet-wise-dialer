# AI Coach Testing Guide

## Prerequisites
1. ✅ `get-realtime-token` edge function is deployed (Status: ACTIVE)
2. ✅ `OPENAI_API_KEY` environment variable is set in Supabase
3. ✅ Browser has microphone permissions enabled
4. ✅ You have an active lead selected

## Testing Steps

### Step 1: Open Browser Console
1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Keep it open during testing to see real-time logs

### Step 2: Start a Call
1. Navigate to the **Dashboard** page
2. Select a lead from the queue
3. Click the **Call** button to start a call
4. **Watch the console** for these messages:
   - `[Dashboard] Call active, connecting AI coach...`
   - `[RealtimeAI] Initializing connection to OpenAI...`
   - `[RealtimeAI] Got ephemeral token, connecting to OpenAI...`
   - `[RealtimeAI] WebSocket connected`
   - `[RealtimeAI] Session created successfully`

### Step 3: Open AI Coach Tab
1. During the call, click on the **"AI Coach"** card
2. Click on the **"Real-time AI"** tab
3. **Check the connection status badge**:
   - 🟢 **Green "AI Connected"** = Success!
   - 🟡 **Yellow "Connecting AI..."** = Still connecting
   - 🔴 **Red "AI Disconnected"** = Connection failed

### Step 4: Test Conversation Capture
1. While on the call, speak into your microphone
2. The AI coach should capture your speech via the **Live Pitch Script** component
3. **Watch the console** for:
   - `[LivePitchScript] Transcript update: ...`
   - `[LivePitchScript] Sending buffered transcript to AI: ...`
   - `[RealtimeAI] Sending context: ...`
   - `[RealtimeAI] Received event: response.text.delta`
   - `[RealtimeAI] Complete response: ...`

### Step 5: Check for Suggestions
1. After speaking for a few seconds, check the **CallSentimentOrb** component
2. You should see:
   - **Sentiment indicator** (neutral/positive/negative/critical)
   - **AI Suggestions** appearing below the sentiment orb
   - Each suggestion should have:
     - A title
     - A message/description
     - A confidence badge
     - A type badge (action/compliance/info/sentiment)

## Expected Console Output (Success)

```
[Dashboard] Call active, connecting AI coach...
[RealtimeAI] Initializing connection to OpenAI...
[RealtimeAI] Got ephemeral token, connecting to OpenAI...
[RealtimeAI] WebSocket connected
[RealtimeAI] Session created successfully
[RealtimeAI] Session updated successfully
[Dashboard] Sending initial context to AI: New call started with lead...
[RealtimeAI] Sending context: New call started...
[RealtimeAI] Context sent and response requested
[RealtimeAI] Received event: response.output_item.added
[RealtimeAI] Received event: response.content_part.added
[RealtimeAI] Received event: response.text.delta
[RealtimeAI] Complete response: [AI suggestion text]
[RealtimeAI] Processing complete text: ...
[RealtimeAI] Analyzed sentiment: positive
[RealtimeAI] Creating suggestion: [Suggestion title]
[useRealtimeAI] New suggestion: {...}
```

## Common Errors & Solutions

### Error 1: "Failed to get ephemeral token"
**Symptoms:**
- Console shows: `[RealtimeAI] Error initializing: Failed to get ephemeral token`
- Badge shows: 🔴 "AI Disconnected"

**Solutions:**
1. Check Supabase Dashboard → Edge Functions → `get-realtime-token` → Logs
2. Verify `OPENAI_API_KEY` is set in Supabase secrets
3. Check if OpenAI API key is valid and has Realtime API access

### Error 2: "WebSocket connection failed"
**Symptoms:**
- Console shows: `[RealtimeAI] WebSocket error: ...`
- Connection closes immediately

**Solutions:**
1. Check internet connection
2. Verify OpenAI Realtime API is accessible
3. Check browser console for CORS errors
4. Try refreshing the page

### Error 3: "No suggestions appearing"
**Symptoms:**
- Connection shows as connected (🟢)
- But no suggestions appear

**Solutions:**
1. Check if microphone is working and permissions are granted
2. Verify you're speaking loud enough
3. Check console for transcript updates: `[LivePitchScript] Transcript update`
4. Ensure you're on the "Live Pitch Script" tab (not just "AI Coach")
5. Check if audio is being captured: Look for `[SpeechTracking]` logs

### Error 4: "Session creation failed"
**Symptoms:**
- Console shows: `[Realtime Token] OpenAI error: ...`

**Solutions:**
1. Check OpenAI API key permissions
2. Verify you have access to `gpt-4o-realtime-preview-2024-12-17` model
3. Check OpenAI account billing/quota status

## Debugging Tips

1. **Enable Verbose Logging**: All components log extensively to console
2. **Check Network Tab**: Look for WebSocket connections to `wss://api.openai.com/v1/realtime`
3. **Check Supabase Logs**: Dashboard → Edge Functions → `get-realtime-token` → Logs
4. **Test Token Endpoint**: Try calling the function directly:
   ```javascript
   const { data, error } = await supabase.functions.invoke('get-realtime-token');
   console.log('Token response:', data, error);
   ```

## Manual Test Script

Run this in the browser console while on the Dashboard:

```javascript
// Test AI Coach connection manually
const testAICoach = async () => {
  try {
    console.log('Testing get-realtime-token...');
    const { data, error } = await supabase.functions.invoke('get-realtime-token');
    
    if (error) {
      console.error('❌ Token error:', error);
      return;
    }
    
    console.log('✅ Token response:', data);
    
    if (data?.client_secret?.value) {
      console.log('✅ Token structure is correct');
    } else {
      console.error('❌ Token structure mismatch. Expected: data.client_secret.value');
      console.log('Actual structure:', Object.keys(data || {}));
    }
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
};

testAICoach();
```

## Success Indicators

✅ **Everything is working if you see:**
1. Green "AI Connected" badge
2. Sentiment orb showing sentiment (not just neutral)
3. Suggestions appearing after speaking
4. Console shows successful WebSocket connection
5. No error messages in console

## Next Steps After Testing

If everything works:
- ✅ AI Coach is functional!
- You can now use it during live calls

If there are issues:
- Note the specific error messages
- Check the troubleshooting section above
- Review Supabase function logs
- Verify OpenAI API access and billing
