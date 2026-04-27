# CHATGPT PROMPT — AGENT GUIDE

> **Instructions for ChatGPT:**
> Below is a raw feature dump for a call-centre sales application called the **BetSure Dialer** (also referred to internally as the Bangbet Dialer). Your task is to turn this into a polished, professional user guide addressed to **Agents**. The document should be:
> - Written in plain, friendly, practical English — like a guide a trainer would hand to a new hire on day one
> - Structured with a cover page section, table of contents, and numbered chapters
> - Include step-by-step instructions where relevant — agents are hands-on users
> - Free of technical jargon; explain any terms the first time they appear
> - Formatted so it can be pasted into Google Docs or Microsoft Word and look professional with minimal cleanup
> - Approximately 2,000–3,500 words
>
> The audience is **Agents** — frontline sales representatives who make outbound calls every day. They are comfortable with smartphones and basic computer apps. They need to understand exactly how to use the app to do their job: make calls, manage their leads, track their performance, and schedule follow-ups. Focus on practical, day-to-day usage.

---

## RAW FEATURE DATA

### Application Overview
- **App name:** BetSure Dialer (Bangbet Dialer)
- **Purpose:** A call-centre dialer that helps you make outbound sales calls to betting platform customers, manage your leads, and track your own performance
- **Who you are calling:** Existing betting platform customers — dormant, semi-active, or VIP — to re-engage them, encourage deposits, and help them get more value from the platform

---

### Logging In & Your Profile
- Login with your company email and password
- New accounts require manager/admin approval before first login
- Once logged in, you stay logged in until you manually sign out
- **Profile settings** (Settings page): update your name, email, and upload a profile photo
- **Password change:** Settings → Security — enter current password, then new password

---

### Your Dashboard (Home Screen)
When you log in you land on your personal dashboard. Everything you need for the day is here:

**Your live KPIs (always visible):**
- Calls made today
- Connect rate (what percentage of your dials were answered)
- Conversions (how many leads deposited after your call)
- Total deposits generated
- Yesterday's figures shown alongside for comparison

**Your lead queue:**
- A list of all leads assigned to you
- Each lead shows: name, phone number, segment (VIP / Semi-Active / Dormant), last activity, lead score
- Click any lead to start a call

**Your status selector:**
- Set yourself as: **Online** (ready to call), **On Call** (automatically set when a call is active), **On Break**, or **Offline**
- Your manager can see your status in real time — keep it accurate

---

### Making a Call

**Step-by-step:**
1. Find the lead you want to call in your queue on the dashboard
2. Click the call button next to their name — the softphone dials automatically
3. The active call panel appears, showing:
   - Lead name and number
   - A running call timer
   - Mute button
   - Hold button
   - End call button
4. When the call connects, the **AI Sidekick** panel opens alongside (see below)
5. After the call ends, the **After-Call Summary** screen appears

**Manual dialling:**
- Open the dial pad on the softphone panel
- Type any number manually and press call
- Useful for numbers not in your lead list

**Call types you will encounter:**
- **Outbound** — you dial out (most common)
- **Callback** — a follow-up call you previously scheduled
- **Inbound** — a customer calls in (less common)

---

### The AI Sidekick (Real-Time Call Coaching)
During every connected call, the AI Sidekick panel is active. It helps you perform better in real time:

- **Pitch suggestions:** Based on the campaign assigned to the lead, the AI shows you relevant talking points
- **Sentiment analysis:** Tracks whether the conversation is going positively, neutrally, or negatively — you see a live indicator
- **Live guidance:** If the call is heading in a difficult direction, the AI suggests phrases or approaches to redirect it
- **Context-aware:** The AI knows the lead's segment (VIP / dormant / semi-active) and adjusts advice accordingly

You do not have to follow every suggestion — use it as a coaching assistant, not a script.

---

### After-Call Summary (ACS)
After every call ends, a short summary screen appears. Fill this in before moving to your next lead:

- **Call status:** select what happened — Connected, No Answer, Busy, Voicemail, Disconnected, Converted
- **Notes:** type anything important about the conversation (objections raised, best time to call back, what the customer said)
- **Deposit tracking:** if the customer committed to depositing, note the expected amount
- Notes auto-save — you will not lose them if you navigate away

Completing the ACS accurately helps your manager understand your calls and contributes to your performance metrics. Do not skip it.

---

### Your Lead Queue & Lead Information
Each lead in your queue has a profile. Click a lead to open it and see:

- **Name and phone number**
- **Segment:** VIP, Semi-Active, or Dormant — tells you the customer's value and engagement level
- **Lead score:** 0–100, calculated from their betting history. Higher score = higher-value prospect
- **Traits:** e.g. Casino Player, Aviator Player, High Roller — use these to tailor your pitch
- **Last deposit amount** and **last bet date**
- **Lifecycle stage:** where this lead sits in the sales funnel
  - New → Called → Interested → Follow-up → Converting → Converted → Dead
- **Campaign:** which campaign this lead belongs to
- **Call history:** every previous call made to this lead, with notes

**Tip:** Before dialling, spend 10–15 seconds reviewing the lead profile. Knowing they are an Aviator player or a High Roller lets you personalise the opening of your call.

---

### Lead Status & Lifecycle Management
After each call, the lead's lifecycle stage updates based on your ACS input:

| Stage | Meaning |
|---|---|
| New | Lead has been assigned but not yet called |
| Called | At least one call attempt made |
| Interested | Customer showed interest during the call |
| Follow-up | Agreed to a follow-up call at a specific time |
| Converting | Customer is actively engaging / about to deposit |
| Converted | Customer deposited after your call — success |
| Dead | Customer has no interest; stop calling |

Moving leads through these stages accurately ensures your pipeline is clean and your manager can see real progress.

---

### Scheduling Callbacks
If a customer asks you to call back at a specific time:

1. In the After-Call Summary, select "Schedule Callback"
2. Set the date, time, and priority (Low / Medium / High / Urgent)
3. Add a note (e.g. "call after 6pm", "waiting for salary to come in")
4. The callback appears in your **Callbacks page**

**The Callbacks page** shows all your scheduled follow-ups organised into:
- **Today** (including anything overdue — highlighted)
- **This Week**
- **Next Week**
- **Later**

When a callback is overdue it is flagged so you know to prioritise it. Never let overdue callbacks pile up — they represent leads who asked you to call back and are expecting you.

---

### Promising Leads
**Location:** Promising Leads (side menu)

This page shows leads that are progressing through the funnel — specifically those in the Interested, Follow-up, Converting, and Converted stages. Use it to:
- Keep a focused eye on your hottest prospects
- See which converted leads have been attributed deposits after your calls
- Ensure your follow-ups are happening on time

---

### Performance Page
**Location:** Performance (side menu)

Your personal performance dashboard with full history:

**Metrics tracked:**
- Total calls made
- Connect rate
- Conversions
- Conversion rate
- Revenue generated (total deposits attributed to you)

**Filters:**
- Today, Yesterday, Last 7 days, Last 30 days, This Month, Custom date range

**Funnel view:**
- Dials → Connects → Qualified → Conversions
- See exactly where leads are dropping off in your process

**Reports:**
- Export your own performance report as PDF, Excel, or Word
- Use this to prepare for performance reviews or track your own progress

---

### Campaigns
**Location:** Campaigns (side menu)

Campaigns are organised calling initiatives — each one has a target audience, goals, and a specific pitch script. As an agent:
- See which campaigns are active and what their targets are
- Know which leads belong to which campaign
- Use the campaign pitch script (surfaced by the AI Sidekick during calls) to stay on message
- Track how many calls and conversions each campaign has achieved

You will typically be assigned to one or more campaigns by your manager. Your calls and conversions are counted against those campaign targets.

---

### Leads Page (Full Lead Table)
**Location:** Leads (side menu)

A full table view of all your assigned leads with search and filter:
- **Search** by name or phone number
- **Filter** by segment (VIP, Semi-Active, Dormant) or campaign
- **Edit** lead details if information is incorrect
- **View call history** for any lead
- Use this page when you want to find a specific lead quickly rather than scrolling the dashboard queue

---

### Notifications & Alerts
The app will notify you about:
- **Overdue callbacks** — a callback is past its scheduled time
- **Connection issues** — if the VoIP connection drops
- **Import completions** — when your manager pushes new leads to you
- **General confirmations** — when notes are saved, calls are logged, etc.

Notifications appear as short banners at the top/bottom of the screen and disappear automatically.

---

### Settings
**Location:** Settings (side menu, bottom)

- **Profile:** update your name, email, upload/change your profile photo (max 2 MB)
- **Security:** change your password — you must enter your current password to confirm
- **App updates:** if a new version is available (desktop app), you will see a prompt here — always update when prompted

---

### Daily Workflow — Your Ideal Day

Use this as a checklist to structure your day:

**Start of day:**
1. Open the app and set your status to **Online**
2. Check the **Callbacks page** — any overdue or today's callbacks? Start with those
3. Review your **dashboard** — how many leads are in your queue?
4. Note your KPIs from yesterday to set a personal target for today

**During the day:**
1. Work through leads systematically — do not skip leads without a reason
2. For every call: review the lead profile briefly before dialling
3. Use the AI Sidekick coaching during calls
4. Complete the After-Call Summary immediately after every call — do not batch them
5. Schedule callbacks the moment a customer requests one
6. Move leads through lifecycle stages as they progress

**End of day:**
1. Clear any remaining ACS forms
2. Check your Callbacks page — no overdue items should remain unaddressed
3. Review your performance page — how do today's numbers compare?
4. Set your status to **Offline** before closing the app

---

### Tips for Success

- **Lead score matters:** prioritise high-score leads early in the day when energy is high — they are more likely to convert
- **Traits tell a story:** a "High Roller" who is dormant needs a different conversation than a "Casino Player" who is semi-active
- **Callbacks are promises:** treat every callback like an appointment — the customer is expecting you
- **Notes are your memory:** thorough call notes mean your next call to the same lead can reference what was discussed previously
- **Conversions lag:** a customer might deposit hours or even a day after your call — do not assume a call failed just because they did not convert immediately
- **Quality score:** your manager sees your quality score — it is based on 5 checklist items (greeting, verification, listening, product knowledge, closing). Nail these every call

---

### Glossary

| Term | Meaning |
|---|---|
| Connect Rate | % of your dials where the customer actually answered |
| Conversion | A lead who made a deposit after you called them |
| Conversion Rate | % of connected calls that led to a deposit |
| Dormant | A customer who has not been active on the platform recently |
| Lead Score | 0–100 score based on the lead's betting history and recency |
| Lifecycle Stage | Where the lead is in the sales funnel (New → Converted) |
| Quality Score | Your call quality score based on the 5-point manager checklist |
| Semi-Active | A customer with moderate platform activity |
| Segment | Lead classification: VIP, Semi-Active, or Dormant |
| Softphone | The built-in phone dialler inside the app |
| VIP | A high-value, high-deposit customer |
| ACS | After-Call Summary — the form you fill in after every call |
| AI Sidekick | The real-time AI coaching assistant active during your calls |

---

*End of raw data. Please produce the polished Agent guide now.*
