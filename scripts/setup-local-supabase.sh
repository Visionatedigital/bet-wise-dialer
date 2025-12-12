#!/bin/bash

# BetSure Dialer - Local Supabase Setup Script
# This script sets up a local Supabase instance for development

set -e

echo "========================================="
echo "  BetSure Dialer - Local Supabase Setup"
echo "========================================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop first:"
    echo "   brew install --cask docker"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker daemon not running. Please start Docker Desktop."
    exit 1
fi

echo "✓ Docker is running"

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    brew install supabase/tap/supabase
fi

echo "✓ Supabase CLI: $(supabase --version)"

# Navigate to project directory
cd "$(dirname "$0")/.."
echo "✓ Working directory: $(pwd)"

# Stop any existing Supabase instance
echo ""
echo "Stopping any existing Supabase instance..."
supabase stop 2>/dev/null || true

# Start Supabase
echo ""
echo "Starting local Supabase (this may take a few minutes on first run)..."
supabase start

# Get the local credentials
echo ""
echo "========================================="
echo "  Local Supabase Started Successfully!"
echo "========================================="
echo ""
supabase status

echo ""
echo "========================================="
echo "  Next Steps:"
echo "========================================="
echo ""
echo "1. Copy the API URL and anon key from above"
echo ""
echo "2. Update your .env file with local credentials:"
echo "   VITE_SUPABASE_URL=http://127.0.0.1:54321"
echo "   VITE_SUPABASE_ANON_KEY=<anon key from above>"
echo ""
echo "3. Access local services:"
echo "   - Supabase Studio: http://127.0.0.1:54323"
echo "   - API: http://127.0.0.1:54321"
echo "   - Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres"
echo ""
echo "4. Run migrations (if needed):"
echo "   supabase db push"
echo ""
echo "5. Start the app:"
echo "   npm run dev"
echo ""

