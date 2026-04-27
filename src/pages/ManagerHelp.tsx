import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ChevronDown, ChevronRight, BookOpen, Upload, Users, BarChart3, Target,
  RefreshCcw, Zap, FileText, Settings, Phone, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────
type Step = { title: string; detail: string };
type Section = {
  id: string;
  icon: React.ElementType;
  color: string;
  title: string;
  subtitle: string;
  steps: Step[];
};

// ─── Help Content ────────────────────────────────────────────────────────────
const SECTIONS: Section[] = [
  {
    id: "import",
    icon: Upload,
    color: "text-blue-600",
    title: "Importing Leads",
    subtitle: "Upload a platform export and get leads categorised instantly",
    steps: [
      {
        title: "Prepare your file",
        detail:
          "Export your leads from the betting platform. The file should be .xlsx, .xls, or .csv. The platform export uses Chinese column headers (e.g. 充值金额(美金)) — the app handles these automatically. A generic CSV with at least a 'phone' column also works.",
      },
      {
        title: "Open Import Leads",
        detail:
          "In the left sidebar click Import Leads. You will see a large drag-and-drop zone. Either drag your file onto it or click Choose file to browse.",
      },
      {
        title: "Review the parsed categories",
        detail:
          "After the file is selected the app immediately reads it and groups leads into: High Stakers (≥$1,000 deposited), Medium Stakers (≥$200), Frequent Bettors (500+ bets), Low Stakers, and Dormant. Click any category header to expand and preview the phone numbers inside.",
      },
      {
        title: "Confirm import",
        detail:
          "Click the green Confirm & Import button. The app sends leads to the server in batches of 100. Duplicates are handled intelligently — active pipeline leads are only enriched, dead leads older than 30 days are recycled, and leads marked dead within 30 days are skipped.",
      },
      {
        title: "Assign leads to agents",
        detail:
          "Once imported you land on Step 3. Select the agent from the dropdown at the top. Then check individual leads or use Select All on a category header to tick the whole group. Hit Assign leads — the server distributes them directly to that agent.",
      },
    ],
  },
  {
    id: "performance",
    icon: RefreshCcw,
    color: "text-purple-600",
    title: "Refreshing Performance Data",
    subtitle: "Upload a new platform export to update deposit & bet statistics",
    steps: [
      {
        title: "Go to Refresh Performance",
        detail:
          "Click Refresh Performance in the left sidebar. This page is for updating existing lead records with fresh deposit and betting data from the platform — it does NOT create new leads.",
      },
      {
        title: "Upload the latest export",
        detail:
          "Use the same betting-platform export format. Drop the file on the upload zone. The app matches phone numbers against existing leads using a digit-only comparison (handles +256 vs 256 variations).",
      },
      {
        title: "Review the enrichment summary",
        detail:
          "After processing you will see: Matched (leads found in the DB), Upgraded (score went up 5+ pts), Downgraded (score dropped), Conversions Attributed (deposit happened after an agent's call), and Attributed Deposit UGX (revenue linked to agent activity).",
      },
      {
        title: "Understand attribution",
        detail:
          "A deposit is attributed to an agent only if: (a) the deposit amount grew since last import, AND (b) the customer's last login on the platform happened after our last recorded call to them. This prevents crediting agents for pre-existing activity.",
      },
      {
        title: "Promoted to Converted",
        detail:
          "Leads that were Interested or Promised and then made an attributable deposit are automatically promoted to the Converted lifecycle stage. You'll see these counted under Conversions Attributed.",
      },
    ],
  },
  {
    id: "agents",
    icon: Users,
    color: "text-green-600",
    title: "Managing Agents",
    subtitle: "Approve, monitor and manage your agent team",
    steps: [
      {
        title: "Approve a new agent",
        detail:
          "When an agent signs up they have Pending status. Go to Settings → User Management, find the agent in the Pending list and click Approve. They can then log in to the app.",
      },
      {
        title: "Monitor live agent activity",
        detail:
          "Click Agent Monitoring in the sidebar. You'll see each agent's current status (Available, On Call, Break), today's call count, and the leads they're working. The page auto-refreshes every 30 seconds.",
      },
      {
        title: "Reassign leads between agents",
        detail:
          "From the Manage Leads view (or after an import on Step 3), select leads using the checkboxes, pick the destination agent in the dropdown, and click Assign. The leads move to that agent's queue immediately.",
      },
      {
        title: "Remove an agent",
        detail:
          "In User Management, click the three-dot menu next to the agent and select Deactivate. Their leads remain in the system and you can redistribute them to other agents.",
      },
    ],
  },
  {
    id: "campaigns",
    icon: Target,
    color: "text-orange-600",
    title: "Campaigns",
    subtitle: "Create and track telemarketing campaigns",
    steps: [
      {
        title: "Create a campaign",
        detail:
          "Click Campaigns in the sidebar → New Campaign. Give it a name, optional description, and set the date range. Campaigns act as containers — leads are tagged to them when assigned.",
      },
      {
        title: "Assign leads to a campaign",
        detail:
          "From the Leads or Manage Leads pages, select leads and use the Assign to Campaign dropdown option. Alternatively, leads imported while a campaign is active can be bulk-tagged during the assign step.",
      },
      {
        title: "Track campaign performance",
        detail:
          "Open the campaign to see: total leads, calls made, conversion rate, and agent breakdown. The Campaigns dashboard also shows a timeline of daily call activity across all active campaigns.",
      },
    ],
  },
  {
    id: "analytics",
    icon: BarChart3,
    color: "text-cyan-600",
    title: "Analytics Dashboard",
    subtitle: "Read your key performance indicators at a glance",
    steps: [
      {
        title: "Today's metrics bar",
        detail:
          "The top row shows: Calls Today, Contacts Made (call answered), Conversion Rate, and Attributed Revenue. These numbers update in real-time as agents work.",
      },
      {
        title: "Agent leaderboard",
        detail:
          "Below the KPI bar you'll see a sorted list of agents ranked by calls, contacts, and conversions for the selected period. Use the date picker to compare day vs week vs month.",
      },
      {
        title: "Lead pipeline funnel",
        detail:
          "The funnel chart shows how many leads are at each lifecycle stage: New → Called → Interested → Promised → Converted. A wide drop-off between Interested and Promised suggests agents need follow-up coaching.",
      },
      {
        title: "Export data",
        detail:
          "Click the Export button (top-right of any chart or table) to download the data as CSV. You can export the phone number list for enrichment from the Leads page using Export Phones.",
      },
    ],
  },
  {
    id: "promising",
    icon: Zap,
    color: "text-amber-600",
    title: "Promising Leads",
    subtitle: "Track high-value leads in the pipeline",
    steps: [
      {
        title: "What appears here",
        detail:
          "This view shows all leads currently at the Interested or Promised lifecycle stage — people who have shown genuine buying intent. Leads are sorted by score (High Stakers first).",
      },
      {
        title: "Follow-up actions",
        detail:
          "Each lead card shows the date they were last contacted and the cooldown period. Once the cooldown expires the card highlights in green — time to call again. Tap the card to see the full call history.",
      },
      {
        title: "Deposited after call",
        detail:
          "After a Performance Refresh, leads that converted will move to the Converted stage and their attributed deposit amount will appear in the card. This feeds the revenue figures in the Analytics dashboard.",
      },
    ],
  },
  {
    id: "reports",
    icon: FileText,
    color: "text-rose-600",
    title: "Reports",
    subtitle: "Generate detailed performance reports",
    steps: [
      {
        title: "Select a period and agent",
        detail:
          "Go to Reports in the sidebar. Choose a date range (Today, This Week, This Month, Custom) and optionally filter by a specific agent. Click Run Report.",
      },
      {
        title: "Read the report sections",
        detail:
          "The report has four sections: Call Summary (total calls, average duration, contact rate), Disposition Breakdown (bar chart of outcomes), Agent Comparison (side-by-side stats), and Lead Movement (how many moved between lifecycle stages).",
      },
      {
        title: "Export to CSV or print",
        detail:
          "Click Export at the top-right to download a CSV of all underlying data. Use your browser's Print function (Ctrl+P / Cmd+P) to save as PDF for sharing with stakeholders.",
      },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    color: "text-slate-600",
    title: "Settings",
    subtitle: "Configure your profile and system preferences",
    steps: [
      {
        title: "Update your profile",
        detail:
          "Go to Settings → Profile tab. Update your display name, email, or profile photo. Click Save Profile when done.",
      },
      {
        title: "Change your password",
        detail:
          "In Settings → Security, enter your current password, then your new password twice, and click Change Password. Passwords must be at least 8 characters.",
      },
      {
        title: "Telephony / SIP configuration",
        detail:
          "If your organisation uses an on-premise PBX, go to Settings → Telephony. Enter the SIP server address, username, and password provided by your IT team. Click Test Connection to verify, then Save.",
      },
      {
        title: "Notification preferences",
        detail:
          "In Settings → Notifications you can toggle: new lead assignment alerts, callback reminders, and system announcements. Changes take effect immediately.",
      },
    ],
  },
  {
    id: "softphone",
    icon: Phone,
    color: "text-indigo-600",
    title: "Softphone (Call System)",
    subtitle: "Making and managing calls directly from the browser",
    steps: [
      {
        title: "Open the softphone",
        detail:
          "The softphone panel appears in the bottom-right corner of the screen. Click the phone icon to expand it. Make sure your browser has microphone permission — you'll be prompted the first time.",
      },
      {
        title: "Dial a lead",
        detail:
          "On the Dashboard, click Call next to any lead. The softphone auto-populates the number and dials. Alternatively, type a number directly in the softphone keypad and press the green call button.",
      },
      {
        title: "During a call",
        detail:
          "While on a call you'll see the call timer. Use Mute to mute your microphone, Hold to park the call, or Transfer to move the call to another agent (enter their extension).",
      },
      {
        title: "Log the outcome",
        detail:
          "After hanging up a Disposition panel appears automatically. Select the outcome (Interested, Not Interested, No Answer, etc.), add notes, and click Save. This updates the lead's lifecycle stage and sets the next call cooldown.",
      },
    ],
  },
];

// ─── Components ──────────────────────────────────────────────────────────────
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
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center bg-muted", section.color.replace("text-", "bg-").replace("600", "100"))}>
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
              <div className="flex-shrink-0 flex items-start gap-3">
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white mt-0.5",
                  section.color.replace("text-", "bg-")
                )}>
                  {i + 1}
                </span>
              </div>
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

// ─── Page ────────────────────────────────────────────────────────────────────
export default function ManagerHelp() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Manager Help Centre</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Step-by-step guides for every feature in your management dashboard.
              Click any section to expand.
            </p>
          </div>
        </div>

        {/* Quick tip */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <Star className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Tip:</span> The most common daily workflow is Import Leads → Assign to agents → check the Analytics Dashboard for results.
          </p>
        </div>

        {/* Accordion sections */}
        <div className="space-y-3">
          {SECTIONS.map(s => (
            <AccordionItem key={s.id} section={s} />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Need more help? Contact your system administrator.
        </p>
      </div>
    </DashboardLayout>
  );
}
