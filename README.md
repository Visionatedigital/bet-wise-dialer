# BetSure Dialer

A professional call center application for BetSure agents to manage leads, make outbound calls, and track customer interactions.

## Features

- **Softphone/WebRTC Dialer** - Make calls directly from the browser via Africa's Talking
- **Lead Management** - Import, segment, and assign leads to agents
- **AI Coach** - Real-time call suggestions and pitch scripts
- **WhatsApp Integration** - Message customers via WhatsApp Business API
- **Campaign Management** - Create campaigns with target segments and goals
- **Reports & Analytics** - AI-generated performance reports via OpenAI GPT-4
- **Role-Based Access** - Admin, Manager, and Agent dashboards

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Shadcn/UI + TailwindCSS + Radix UI
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Auth**: Supabase Auth with role-based RLS
- **Telephony**: Africa's Talking Voice API + WebRTC
- **AI**: OpenAI GPT-4 for reports + call analysis
- **Desktop**: Tauri (for Windows & macOS builds)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Rust (for desktop builds) - [Install Rust](https://rustup.rs/)

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd bet-wise-dialer

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your Supabase credentials
```

### Environment Variables

Create a `.env` file with the following:

```env
# Required - Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional - App Configuration
VITE_APP_NAME=BetSure Dialer
VITE_APP_ENV=development

# Optional - Feature Flags
VITE_ENABLE_WHATSAPP=true
VITE_ENABLE_AI_COACH=true
VITE_ENABLE_CALL_RECORDING=true
```

### Development

```bash
# Run web development server
npm run dev

# Run desktop app in development mode
npm run tauri:dev
# or
npm run desktop
```

### Building

```bash
# Build web app
npm run build

# Build desktop app for current platform
npm run tauri:build
# or
npm run desktop:build

# Build with debug symbols
npm run tauri:build:debug
```

## Desktop App (Tauri)

The application can run as a standalone desktop app on Windows and macOS using Tauri.

### Building for Distribution

#### macOS
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/dmg/BetSure Dialer_x.x.x_x64.dmg
```

#### Windows
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/nsis/BetSure Dialer_x.x.x_x64-setup.exe
```

### Desktop Features

- Native window with system tray icon
- Single instance enforcement (prevents multiple windows)
- Native notifications for callbacks and alerts
- Optimized release builds with LTO

## Project Structure

```
bet-wise-dialer/
├── src/                    # React frontend source
│   ├── components/         # UI components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React contexts
│   ├── integrations/       # Supabase client
│   └── utils/              # Utility functions
├── src-tauri/              # Tauri desktop app
│   ├── src/                # Rust source code
│   ├── icons/              # App icons
│   └── tauri.conf.json     # Tauri configuration
├── supabase/               # Supabase configuration
│   ├── functions/          # Edge Functions
│   └── migrations/         # Database migrations
└── public/                 # Static assets
```

## Supabase Configuration

The following secrets need to be configured in your Supabase project dashboard:

| Secret | Description |
|--------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for AI reports |
| `AFRICASTALKING_API_KEY` | Africa's Talking API key |
| `AFRICASTALKING_USERNAME` | Africa's Talking username |
| `AFRICASTALKING_SIP_USERNAME` | SIP username for WebRTC |
| `AFRICASTALKING_SIP_PASSWORD` | SIP password for WebRTC |
| `AFRICASTALKING_PHONE_NUMBER` | Caller ID phone number |

## User Roles

| Role | Access Level |
|------|-------------|
| **Admin** | Full system access, user approval, lead import |
| **Manager** | Monitor agents, team reports, campaign management |
| **Agent** | Make calls, manage leads, view personal KPIs |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

Proprietary - © 2025 BetSure. All rights reserved.
