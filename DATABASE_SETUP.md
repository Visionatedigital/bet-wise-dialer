# Database Setup Guide

This guide explains how to configure the BetSure Dialer to work with different database backends.

## Overview

The application supports three database modes:
1. **Supabase Cloud** - Production cloud database
2. **Local Supabase** - Development with Docker
3. **Custom Server** - Company-hosted PostgreSQL via PostgREST

All Supabase logic is preserved and can be switched via environment variables.

## Mode 1: Supabase Cloud

**Best for:** Production environments

### Setup Steps

1. Create a `.env` file:
```env
VITE_DATABASE_MODE=supabase-cloud
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Or use the helper script:
```bash
npm run use:cloud
```

### Getting Credentials

1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings > API
4. Copy the Project URL and anon/public key

## Mode 2: Local Supabase

**Best for:** Development and testing

### Prerequisites

- Docker Desktop installed and running
- Supabase CLI installed

### Setup Steps

1. Install Supabase CLI:
```bash
# macOS
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or via npm
npm install -g supabase
```

2. Start local Supabase:
```bash
npm run supabase:setup
```

3. Switch to local mode:
```bash
npm run use:local
```

### Accessing Local Services

- **Supabase Studio:** http://127.0.0.1:54323
- **API:** http://127.0.0.1:54321
- **Database:** postgresql://postgres:postgres@127.0.0.1:54322/postgres

## Mode 3: Custom Server (Company-hosted PostgreSQL)

**Best for:** Company infrastructure with self-hosted PostgreSQL

### Prerequisites

Your company needs to set up:
1. **PostgreSQL Database** - With schema matching Supabase structure
2. **PostgREST API Server** - Exposing PostgreSQL via REST API
3. **Authentication** - Either Supabase Auth or custom auth system

### PostgREST Setup

PostgREST is a REST API generator for PostgreSQL. It provides a Supabase-compatible API.

**Example PostgREST configuration (`postgrest.conf`):**
```ini
db-uri = "postgresql://user:password@localhost:5432/betsure_dialer"
db-schema = "public"
db-anon-role = "anon"
db-pool = 10
server-host = "0.0.0.0"
server-port = 3000
```

**Starting PostgREST:**
```bash
postgrest postgrest.conf
```

### Application Setup

**On Windows (PowerShell):**
```powershell
.\scripts\use-custom-server.ps1
```

**On Linux/Mac (Bash):**
```bash
chmod +x scripts/use-custom-server.sh
./scripts/use-custom-server.sh
```

**Manual Setup:**
Create a `.env` file:
```env
VITE_DATABASE_MODE=custom-server
VITE_CUSTOM_DB_URL=http://your-server:3000
VITE_CUSTOM_DB_KEY=your-postgrest-anon-key
VITE_CUSTOM_DB_SCHEMA=public
```

### Important Considerations

#### Database Schema

Your PostgreSQL database must have the same schema structure as Supabase. You can:

1. **Export from Supabase:**
```bash
supabase db dump -f schema.sql
```

2. **Import to PostgreSQL:**
```bash
psql -U postgres -d betsure_dialer -f schema.sql
```

#### Row Level Security (RLS)

If your Supabase setup uses RLS policies, you'll need to:
- Replicate RLS policies in PostgreSQL
- Configure PostgREST to respect RLS
- Or implement custom authorization logic

#### Authentication

**Option A: Use Supabase Auth**
- Set up Supabase Auth service separately
- Point application to Supabase Auth endpoint
- Use Supabase JWT tokens

**Option B: Custom Auth**
- Implement custom authentication
- Modify `src/integrations/supabase/client.ts` auth configuration
- Update `src/contexts/AuthContext.tsx` if needed

#### API Compatibility

PostgREST provides a Supabase-compatible API, but ensure:
- Same table names and structure
- Same column types
- Same API endpoints (`/rest/v1/`)
- Same authentication headers (`apikey`, `Authorization`)

### Testing Custom Server Connection

1. Start your PostgREST server
2. Test API endpoint:
```bash
curl http://your-server:3000/rest/v1/profiles \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-token"
```

3. Run the application:
```bash
npm run dev
```

## Switching Between Modes

You can switch database modes by updating your `.env` file and restarting the application:

```bash
# Switch to cloud
npm run use:cloud

# Switch to local
npm run use:local

# Switch to custom server
.\scripts\use-custom-server.ps1  # Windows
./scripts/use-custom-server.sh   # Linux/Mac
```

## Troubleshooting

### Connection Errors

**Error:** `Missing Supabase URL`

**Solution:** Ensure `.env` file exists and has correct `VITE_DATABASE_MODE` and corresponding URL/key variables.

### Custom Server Not Responding

**Error:** `Failed to fetch` or connection timeout

**Solution:**
- Verify PostgREST server is running
- Check firewall settings
- Verify URL is correct (include `http://` or `https://`)
- Check network connectivity

### Schema Mismatch

**Error:** Table not found or column errors

**Solution:**
- Ensure database schema matches Supabase structure
- Run migrations from `supabase/migrations/` directory
- Verify schema name in `VITE_CUSTOM_DB_SCHEMA`

### Authentication Issues

**Error:** Unauthorized or auth errors

**Solution:**
- Verify API key is correct
- Check PostgREST `db-anon-role` configuration
- Ensure RLS policies allow access
- Verify JWT token if using Supabase Auth

## Migration from Supabase to Custom Server

1. **Export data from Supabase:**
```bash
supabase db dump -f data.sql
```

2. **Set up PostgreSQL server** with PostgREST

3. **Import schema and data:**
```bash
psql -U postgres -d betsure_dialer -f schema.sql
psql -U postgres -d betsure_dialer -f data.sql
```

4. **Configure application** to use custom server mode

5. **Test thoroughly** before deploying to production

## Additional Resources

- [PostgREST Documentation](https://postgrest.org/)
- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

