# Deploy Edge Functions - Quick Guide

## Option 1: Deploy via Supabase Dashboard (Easiest)

1. **Go to your Supabase Dashboard:**
   - Visit: https://app.supabase.com
   - Select your project: `hahkgifqajdnhvkbzwfx`

2. **Navigate to Edge Functions:**
   - Click on "Edge Functions" in the left sidebar
   - Or go to: https://app.supabase.com/project/hahkgifqajdnhvkbzwfx/functions

3. **Deploy the functions:**
   - Find `analyze-funnel` function
   - Click "Deploy" or "Edit"
   - Copy the contents from `supabase/functions/analyze-funnel/index.ts`
   - Paste and save
   - Repeat for `analyze-agents` function

## Option 2: Deploy via CLI (Requires Login)

### Step 1: Install Supabase CLI

**Windows (via Scoop):**
```powershell
# Install Scoop if you don't have it
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Or via npm (use npx):**
```powershell
# Just use npx, no installation needed
npx supabase --version
```

### Step 2: Login to Supabase

```powershell
npx supabase login
```

This will open your browser to authenticate.

### Step 3: Link Your Project

```powershell
cd bet-wise-dialer
npx supabase link --project-ref hahkgifqajdnhvkbzwfx
```

### Step 4: Deploy Functions

```powershell
# Deploy analyze-funnel
npx supabase functions deploy analyze-funnel

# Deploy analyze-agents
npx supabase functions deploy analyze-agents
```

## Option 3: Manual Upload via Dashboard

1. Go to: https://app.supabase.com/project/hahkgifqajdnhvkbzwfx/functions
2. For each function (`analyze-funnel` and `analyze-agents`):
   - Click "Create Function" or edit existing
   - Name: `analyze-funnel` or `analyze-agents`
   - Copy the entire contents from:
     - `supabase/functions/analyze-funnel/index.ts`
     - `supabase/functions/analyze-agents/index.ts`
   - Paste into the editor
   - Click "Deploy"

## Quick Deploy Commands (After Login)

Once you're logged in, you can use:

```powershell
# Navigate to project
cd C:\Users\LUBS\Downloads\Betsure_dialer\bet-wise-dialer

# Deploy both functions
npx supabase functions deploy analyze-funnel
npx supabase functions deploy analyze-agents
```

## Verify Deployment

After deploying, check the function logs in the Supabase Dashboard to ensure they're working correctly.

## Troubleshooting

If you get "Access token not provided":
1. Run: `npx supabase login`
2. Authenticate in the browser
3. Try deploying again

If functions still return 500 errors:
- Check the function logs in Supabase Dashboard
- Verify environment variables are set (OPENAI_API_KEY, SUPABASE_URL, etc.)
- The updated code should handle errors gracefully and return 200 status codes
