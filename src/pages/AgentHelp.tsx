import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ChevronDown, ChevronRight, BookOpen, Phone, CheckSquare, PhoneCall,
  BarChart3, Calendar, Settings, Star, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { title: string; detail: string };
type Section = {
  id: string;
  icon: React.ElementType;
  color: string;
  title: string;
  subtitle: string;
  steps: Step[];
};

const SECTIONS: Section[] = [
  {
    id: "start",
    icon: Phone,
    color: "text-green-600",
    title: "Getting Started & Making Calls",
    subtitle: "Your daily workflow as a dialer agent",
    steps: [
      {
        title: "Log in",
        detail:
          "Open the app and enter your email and password. If this is your first time, your manager must approve your account before you can log in. Contact your manager if you get an 'Account pending approval' message.",
      },
      {
        title: "Check your Dashboard",
        detail:
          "After logging in you land on the Dashboard. Here you see your lead queue — the next leads to call, sorted by priority. Your today's stats (calls made, contacts, conversions) appear at the top.",
      },
      {
        title: "Start the softphone",
        detail:
          "Look for the phone widget in the bottom-right corner. Click it to expand. The first time you'll be asked to allow microphone access — click Allow in the browser prompt. You must be on the same network as the PBX, or connected via VPN.",
      },
      {
        title: "Call a lead",
        detail:
          "On the Dashboard, each lead card has a green Call button. Click it — the softphone will dial automatically. You'll hear ringing through your headset or speakers. Do NOT close the tab while a call is active.",
      },
      {
        title: "Save the outcome after every call",
        detail:
          "When you hang up, a Disposition popup appears. You MUST select an outcome for every call: Interested, Not Interested, No Answer, Promised Deposit, Unreachable, or other. Add a short note, then click Save. Missing this step means the lead won't be scheduled for follow-up.",
      },
    ],
  },
  {
    id: "leads",
    icon: CheckSquare,
    color: "text-blue-600",
    title: "Managing Your Leads",
    subtitle: "Viewing, filtering and updating lead records",
    steps: [
      {
        title: "Leads board (Kanban view)",
        detail:
          "Click Leads in the sidebar. You'll see a board with columns for each lifecycle stage: New, Called, Interested, Promised, Converted. Drag a lead card to move it between stages, or use the Disposition popup after a call to move it automatically.",
      },
      {
        title: "Filter your leads",
        detail:
          "Use the filter bar at the top: filter by segment (VIP, Semi-Active, Dormant), priority (High, Medium, Low), or status. Use the search box to find a lead by name or phone number.",
      },
      {
        title: "View a lead's full history",
        detail:
          "Click on any lead card to open the detail drawer. Here you'll see: all past call notes, the lead's deposit history (if imported from the platform), preferred product (Sports/Gaming), and the timeline of events.",
      },
      {
        title: "Add a manual note",
        detail:
          "Inside the lead detail drawer, scroll to the Notes section and type your note, then click Add Note. Notes are permanent and visible to your manager.",
      },
      {
        title: "Cooldown indicator",
        detail:
          "Each lead shows a coloured dot: green = call now, yellow = cooling down (check back soon), red/grey = do not disturb. The cooldown is set automatically based on the last call outcome.",
      },
    ],
  },
  {
    id: "callbacks",
    icon: PhoneCall,
    color: "text-amber-600",
    title: "Callbacks",
    subtitle: "Managing scheduled follow-up calls",
    steps: [
      {
        title: "Scheduling a callback",
        detail:
          "During or after a call, if the customer asks you to call back at a specific time, select Callback in the Disposition panel. A date/time picker appears — set the agreed time and click Save. The lead is moved to your Callbacks list.",
      },
      {
        title: "Viewing due callbacks",
        detail:
          "Click Callbacks in the sidebar. Leads are sorted by due time — overdue callbacks appear first in red. Click the green Call button to dial immediately.",
      },
      {
        title: "Rescheduling a callback",
        detail:
          "If the customer asks to reschedule, open the lead and click Reschedule Callback. Pick the new time and save. The old callback is replaced.",
      },
      {
        title: "What happens if you miss a callback",
        detail:
          "Overdue callbacks stay at the top of your list highlighted in red. Your manager can also see which callbacks you've missed in the Agent Monitoring panel. Try to clear all overdue callbacks before your shift ends.",
      },
    ],
  },
  {
    id: "performance",
    icon: BarChart3,
    color: "text-purple-600",
    title: "Your Performance",
    subtitle: "Understanding your stats and reports",
    steps: [
      {
        title: "Today's stats",
        detail:
          "At the top of your Dashboard you'll see: Calls Today, Contacts Made (calls where someone answered), Conversion Rate, and Attributed Deposits. These update live as you work.",
      },
      {
        title: "Full performance report",
        detail:
          "Click Reports in the sidebar. Select a date range (Today, This Week, etc.) to see your full breakdown: total calls, average call duration, dispositions by type, and a daily trend chart.",
      },
      {
        title: "Understanding conversion rate",
        detail:
          "Conversion Rate = (Converted leads ÷ Total leads called) × 100. A lead converts when it was marked Interested or Promised AND a deposit shows up in the next platform import dated after your call.",
      },
      {
        title: "Attributed deposits",
        detail:
          "If your manager imports a fresh platform export after your calls, any deposits made by leads you spoke with will be attributed to you. These appear in your performance report as Attributed Revenue (UGX).",
      },
    ],
  },
  {
    id: "campaigns",
    icon: Calendar,
    color: "text-rose-600",
    title: "Campaigns",
    subtitle: "Working within a campaign",
    steps: [
      {
        title: "Finding your active campaign",
        detail:
          "Click Campaigns in the sidebar. Your currently assigned campaign appears at the top. Click it to see its goals, deadline, and your progress within it.",
      },
      {
        title: "Campaign-specific leads",
        detail:
          "Your Dashboard automatically filters leads to show your assigned campaign's leads first. You can switch the campaign filter in the top bar if you're assigned to multiple campaigns.",
      },
      {
        title: "Campaign leaderboard",
        detail:
          "Inside a campaign you'll see a leaderboard ranking all agents working on it. This resets each campaign period. Keep your call count and conversion rate high to stay at the top.",
      },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    color: "text-slate-600",
    title: "Settings & Your Account",
    subtitle: "Updating your profile and preferences",
    steps: [
      {
        title: "Update your name or email",
        detail:
          "Click Settings in the sidebar. In the Profile section, update your Full Name or Email, then click Save Profile.",
      },
      {
        title: "Change your password",
        detail:
          "In Settings, scroll to the Change Password section. Enter your Current Password, then your New Password (minimum 8 characters), confirm it, and click Change Password.",
      },
      {
        title: "Sign out",
        detail:
          "At the bottom of the sidebar there is a Sign Out button. Always sign out when leaving your workstation to protect customer data.",
      },
    ],
  },
  {
    id: "tips",
    icon: MessageCircle,
    color: "text-teal-600",
    title: "Tips for Better Results",
    subtitle: "Best practices for high-converting agents",
    steps: [
      {
        title: "Call High Stakers first",
        detail:
          "High Staker leads (deposited over $1,000) have the highest conversion potential. Your lead queue already sorts them to the top, but if you're ever choosing between leads, always prioritise them.",
      },
      {
        title: "Always log your disposition",
        detail:
          "Every single call needs a disposition saved — even No Answer. Without it, the system can't schedule the next follow-up and your manager's reports will show incomplete data, which reflects poorly on your stats.",
      },
      {
        title: "Use the notes field",
        detail:
          "Write brief, useful notes: what the customer said, what they're interested in, when they said to call back. Future-you (and your manager) will thank you.",
      },
      {
        title: "Don't call cooling-down leads",
        detail:
          "Grey leads have a cooldown. Calling too soon annoys customers and wastes your time. Wait until the dot turns green — the system knows when they're due.",
      },
      {
        title: "Check Callbacks every morning",
        detail:
          "First thing each shift, open Callbacks and handle any overdue ones before moving to new leads. Keeping callbacks current builds trust with customers who were promised a call-back.",
      },
    ],
  },
];

function AccordionItem({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left bg-card hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center",
            section.color.replace("text-", "bg-").replace("600", "100")
          )}>
            <Icon className={cn("h-5 w-5", section.color)} />
          </div>
          <div>
            <p className="font-semibold text-base">{section.title}</p>
            <p className="text-sm text-muted-foreground">{section.subtitle}</p>
          </div>
        </div>
        {open
          ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border bg-muted/10 divide-y divide-border/50">
          {section.steps.map((step, i) => (
            <div key={i} className="flex gap-4 p-5">
              <span className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white mt-0.5",
                section.color.replace("text-", "bg-")
              )}>
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-sm mb-1">{step.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentHelp() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Agent Help Centre</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Everything you need to know to succeed as a Bangbet telemarketing agent.
              Click any topic to expand.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <Star className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            <span className="font-semibold">Daily checklist:</span> Check callbacks → call your lead queue → log every disposition → review your stats before end of shift.
          </p>
        </div>

        <div className="space-y-3">
          {SECTIONS.map(s => (
            <AccordionItem key={s.id} section={s} />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Need more help? Contact your manager.
        </p>
      </div>
    </DashboardLayout>
  );
}
