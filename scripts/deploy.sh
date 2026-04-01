#!/bin/bash

# Configuration
DROPLET_IP="159.89.51.97"
REMOTE_USER="root"
REMOTE_PATH="/opt/bangbet-dialer"

# Ensure essential files exist
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found in current directory!"
    exit 1
fi

if [ ! -d "server" ]; then
    echo "❌ server directory not found!"
    exit 1
fi

echo "🚀 Syncing ESSENTIAL backend files to Droplet ($DROPLET_IP)..."

# Create remote directory
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$DROPLET_IP "mkdir -p $REMOTE_PATH"

# Synchronize ONLY necessary files/folders for the backend
rsync -avz --delete \
    -e "ssh -o StrictHostKeyChecking=no" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=dist \
    --exclude=.next \
    --exclude=mobile \
    --exclude=/src \
    --exclude=/src-tauri \
    --exclude=/public \
    --exclude=/documentation \
    --exclude=/downloads \
    --exclude=/npm-cache \
    --exclude='*.msi' \
    --exclude='*.exe' \
    ./ $REMOTE_USER@$DROPLET_IP:$REMOTE_PATH

echo "🏗️  Starting containers on Droplet..."

# Run Docker Compose on the remote machine
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$DROPLET_IP "cd $REMOTE_PATH && docker compose up -d --build"

echo "✅ Deployment complete!"
echo "📍 Your API is starting at: http://$DROPLET_IP:3001/api/health"
