# Codebase Functionality Overview - BetSure / Bangbet Dialer

This document provides a comprehensive overview of the functionality and architecture of the BetSure/Bangbet Dialer application as of January 2026.

## 1. System Architecture

The application is a modern, full-stack telemarketing platform designed for high-volume call centers.

- **Frontend**: React 18 + TypeScript + Vite.
- **Desktop Environment**: Tauri (Rust) for Windows and macOS distribution.
- **Backend (Serverless)**: Supabase Edge Functions (Deno).
- **Database**: Supabase (PostgreSQL) with Row-Level Security (RLS) and real-time capabilities.
- **Communication**: SIP (sip.js) and WebRTC (Africa's Talking SDK).
- **AI Integration**: OpenAI GPT-4 for analysis, reporting, and real-time coaching.

## 2. Core Functionalities

### 2.1. Softphone & Dialer
- **Dual Mode Connectivity**: 
    - **SIP (Desktop)**: Used in the Tauri environment for stable, background-capable VoIP.
    - **WebRTC (Browser)**: Used in web environments where native SIP might be restricted.
- **Provider**: Integrated with **Africa's Talking** for voice services.
- **Features**: Dial pad, mute, hold, call duration tracking, and auto-dialing capabilities.
- **Post-Call Workflow**: Automatic prompt for call notes, disposition (Lead Strength, Interest Score), and follow-up (Callback) scheduling.

### 2.2. Lead Management
- **Importing**: Supports CSV/Excel ingestion of leads.
- **Segmenting**: Leads can be assigned to different campaigns or specific agents.
- **Tracking**: Real-time status updates (e.g., Connected, No Answer, Busy, Not Interested).
- **Lead Distribution**: Automated lead distribution logic via Supabase Edge Functions.

### 2.3. AI Coaching & Analytics
- **Live Pitch Script**: Real-time script suggestions based on the current lead context.
- **Call Analysis**: Automated transcription and sentiment analysis of call recordings.
- **AI Reports**: Generates performance reports and funnel analysis using OpenAI.
- **Sentiment Orb**: Visual indicator of the call's "mood" or progress.

### 2.4. WhatsApp Integration
- **Business API**: Integration for two-way communication with customers.
- **Media Support**: Support for text, images, and audio messages.
- **AI Responses**: Automated AI-driven responses for common customer inquiries.
- **Unread Tracking**: Visual indicators for pending messages.

### 2.5. Role-Based Access Control (RBAC)
- **Agent**: Focused on calling, lead management, and personal KPIs.
- **Manager**: Team monitoring, live call tracking, and campaign performance reports.
- **Admin**: Full system control including user management (approval/deletion), lead importing, and system settings.
- **Admin View Mode**: Admins can toggle between Agent, Management, and Admin views to test functionality.

### 2.6. Campaign Management
- **Creation**: Define target goals, scripts, and lead segments.
- **Monitoring**: Real-time metrics on campaign progress and conversion rates.

## 3. Technical Implementation Details

### 3.1. Database Schema Highlights
- `leads`: Core table for customer data.
- `call_activities`: Logs every call attempt, duration, and outcome.
- `callbacks`: Scheduled follow-ups for agents.
- `user_roles`: Maps Supabase Auth users to application roles.
- `campaigns`: Grouping of leads and goals.
- `whatsapp_messages`: Storage for WhatsApp communication.

### 3.2. Key Edge Functions
- `get-webrtc-token` / `get-sip-credentials`: Securely provides credentials for calling.
- `sync-call-outcome`: Updates database based on provider webhooks.
- `transcribe-call`: Triggers AI transcription of recordings.
- `generate-ai-report`: Complex aggregation and AI processing for management.
- `distribute-leads`: Background logic for moving leads between agents.

### 3.3. Desktop Integration (Tauri)
- **Auto-Updater**: Integrated GitHub-based update mechanism (`latest.json`).
- **Native Notifications**: System-level alerts for incoming calls or callbacks.
- **Single Instance**: Prevents multiple app windows from running.

## 4. Current State & Recent Updates
- Recent migrations added **Deposit Tracking** to call activities, indicating a deeper integration with financial performance metrics.
- Added `assigned_at` to leads for better distribution tracking and latency analysis.
- The codebase is transitionining/dual-branded between **BetSure** and **Bangbet**.

## 5. Development Workflow
- **Database Modes**: Supports `supabase-cloud`, `supabase-local`, and a `custom-server` (PostgREST) setup.
- **Testing**: Includes scripts for API imports, role setup, and distribution testing in the `scripts/` directory.

---
*Created by AI Assistant for the "mark" branch initialization.*
