# HTML Documentation

This folder contains HTML-formatted documentation for the BetSure Call Center platform.

## Files

### backend-verification.html
Complete backend verification documentation with:
- OpenAI integration details
- Africa's Talking API integration
- Database schema
- Security implementation
- Screenshot placeholders for IT verification

## How to Use

1. Open `backend-verification.html` in any web browser
2. Add screenshots to the designated placeholder sections
3. Share with IT team for backend verification

## Adding Screenshots

To add screenshots to the HTML documentation:

1. Take screenshots following the guide in the document
2. Save images in `documentation/html/images/` folder
3. Update the screenshot placeholders with actual `<img>` tags

Example:
```html
<div class="screenshot-placeholder">
    <img src="images/supabase-functions.png" alt="Supabase Functions Dashboard">
    <p>Supabase Edge Functions Dashboard showing deployed functions</p>
</div>
```

## Screenshot Locations

Required screenshots:
1. **Supabase Functions Dashboard** - https://supabase.com/dashboard/project/hahkgifqajdnhvkbzwfx/functions
2. **AI Report Function Logs** - https://supabase.com/dashboard/project/hahkgifqajdnhvkbzwfx/functions/generate-ai-report/logs
3. **Voice Callback Logs** - https://supabase.com/dashboard/project/hahkgifqajdnhvkbzwfx/functions/voice-callback/logs
4. **Call Activities Table** - https://supabase.com/dashboard/project/hahkgifqajdnhvkbzwfx/editor
5. **Secrets Management** - https://supabase.com/dashboard/project/hahkgifqajdnhvkbzwfx/settings/functions
6. **Sample Exported Report** - Generated from Reports page in the application