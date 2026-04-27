import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, LayoutAnimation,
  Platform, UIManager,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors } from "../../src/theme/colors";

// Enable animation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Step = { title: string; detail: string };
type IconName = React.ComponentProps<typeof Feather>["name"];
type Section = {
  id: string;
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  steps: Step[];
};

// ─── Agent content ────────────────────────────────────────────────────────────
const AGENT_SECTIONS: Section[] = [
  {
    id: "calls",
    icon: "phone",
    iconColor: "#16a34a",
    iconBg: "#dcfce7",
    title: "Making Calls",
    subtitle: "Your daily calling workflow",
    steps: [
      {
        title: "Start your shift",
        detail:
          "Open the app and go to Dashboard. You'll see your lead queue at the top. Your today's call count and conversion stats are shown in the header row.",
      },
      {
        title: "Dial a lead",
        detail:
          "Tap the green Call button on any lead card. The app will dial through your phone's calling app or the integrated softphone. Wait for the customer to pick up.",
      },
      {
        title: "During the call",
        detail:
          "Talk naturally. Listen for buying signals. If they show interest in betting, ask about their preferred sport or game. Note anything useful to follow up on.",
      },
      {
        title: "Log the outcome — every time",
        detail:
          "After every call a Disposition sheet appears. Tap the outcome: Interested, Not Interested, No Answer, Promised Deposit, or Callback. Add a short note, then tap Save. Never skip this step.",
      },
      {
        title: "Cooldown between calls",
        detail:
          "After saving a disposition the lead goes into a cooldown period (e.g. 2 days for No Answer, 7 days for Not Interested). The system will surface it again when it's ready. Move to the next lead in your queue.",
      },
    ],
  },
  {
    id: "leads",
    icon: "check-square",
    iconColor: "#2563eb",
    iconBg: "#dbeafe",
    title: "Your Leads",
    subtitle: "Viewing and managing your lead list",
    steps: [
      {
        title: "Leads list",
        detail:
          "Tap Leads in the drawer menu. You'll see all leads assigned to you, sorted by lead score (highest priority first). Swipe down to refresh.",
      },
      {
        title: "Lead details",
        detail:
          "Tap any lead to open its detail screen. Here you'll see: the phone number, past call notes, deposit history, and preferred product (Sports/Gaming/Lottery).",
      },
      {
        title: "Filtering leads",
        detail:
          "Use the filter buttons at the top to show only: New, Called, Interested, Promised, or Converted leads. This helps you focus on a specific stage.",
      },
      {
        title: "VIP and High Staker leads",
        detail:
          "Leads with a gold crown or 'VIP' badge deposited over $1,000. Treat these with extra attention — they have the highest conversion value. Always call them first.",
      },
    ],
  },
  {
    id: "callbacks",
    icon: "phone-call",
    iconColor: "#d97706",
    iconBg: "#fef3c7",
    title: "Callbacks",
    subtitle: "Scheduled follow-up calls",
    steps: [
      {
        title: "Set a callback",
        detail:
          "During disposition, tap Callback. A date and time picker appears — choose the time the customer asked you to call back and tap Confirm.",
      },
      {
        title: "View your callbacks",
        detail:
          "Tap Callbacks in the drawer. Overdue callbacks (past their scheduled time) appear at the top in red. Handle them first before moving on.",
      },
      {
        title: "Reschedule or cancel",
        detail:
          "Open the callback lead and tap Reschedule to pick a new time, or Cancel Callback to remove it. Always reschedule rather than leaving it overdue.",
      },
    ],
  },
  {
    id: "performance",
    icon: "bar-chart-2",
    iconColor: "#7c3aed",
    iconBg: "#ede9fe",
    title: "Your Performance",
    subtitle: "Understanding your stats",
    steps: [
      {
        title: "Today's summary",
        detail:
          "On the Dashboard you can see your daily totals: Calls Made, Contacts (answered calls), and Conversions. These reset at midnight.",
      },
      {
        title: "Attributed revenue",
        detail:
          "When your manager uploads a fresh platform export, any deposits made by leads you called will be credited to you. This shows as Attributed Revenue (UGX) in your stats.",
      },
      {
        title: "How to improve your rate",
        detail:
          "Call more leads — volume matters. Focus on High Staker and Medium Staker leads. Always follow up after a customer says Interested — they are your hottest prospects.",
      },
    ],
  },
  {
    id: "account",
    icon: "settings",
    iconColor: "#475569",
    iconBg: "#f1f5f9",
    title: "Account & Settings",
    subtitle: "Profile and app preferences",
    steps: [
      {
        title: "Update your profile",
        detail:
          "Tap Settings in the drawer. Update your Full Name or Email, then tap Save Profile.",
      },
      {
        title: "Change your password",
        detail:
          "In Settings, scroll to Change Password. Enter your current password, your new password (minimum 6 characters), confirm it, and tap Change Password.",
      },
      {
        title: "Sign out",
        detail:
          "Scroll to the bottom of Settings and tap Logout. Always sign out when you finish your shift.",
      },
    ],
  },
];

// ─── Manager content ──────────────────────────────────────────────────────────
const MANAGER_SECTIONS: Section[] = [
  {
    id: "import",
    icon: "upload-cloud",
    iconColor: "#2563eb",
    iconBg: "#dbeafe",
    title: "Importing Leads",
    subtitle: "Upload a platform export to load leads",
    steps: [
      {
        title: "Prepare the file",
        detail:
          "Export leads from the betting platform as .xlsx or .csv. Chinese-header exports are auto-detected — no manual mapping needed.",
      },
      {
        title: "Open Import Leads",
        detail:
          "In the drawer menu, tap Import Leads. Tap Choose File and select your export. The app reads it immediately and groups leads by category.",
      },
      {
        title: "Review categories",
        detail:
          "The screen shows: High Stakers (≥$1,000), Medium Stakers (≥$200), Frequent Bettors (500+ bets), Low Stakers, and Dormant. Tap any category to preview the numbers inside.",
      },
      {
        title: "Confirm import",
        detail:
          "Tap Confirm & Import. Duplicates are handled: existing active leads are enriched, dead leads older than 30 days are recycled, and recently-dead leads are skipped.",
      },
      {
        title: "Assign to agents",
        detail:
          "After import, Select leads using the checkboxes (or Select All per category), pick an agent from the dropdown, and tap Assign.",
      },
    ],
  },
  {
    id: "distribute",
    icon: "layers",
    iconColor: "#16a34a",
    iconBg: "#dcfce7",
    title: "Manage Leads",
    subtitle: "View, filter and reassign leads",
    steps: [
      {
        title: "Manage Leads screen",
        detail:
          "Tap Manage Leads in the drawer. You see all leads in your country with filters for segment, status, and assignment.",
      },
      {
        title: "Reassign leads",
        detail:
          "Filter to Unassigned leads, select them using checkboxes, pick an agent, and tap Assign. Use this whenever you have unassigned stock that needs to go to agents.",
      },
      {
        title: "Move leads between agents",
        detail:
          "Filter by a specific agent using the Agent filter, select the leads you want to move, pick the destination agent, and tap Assign.",
      },
    ],
  },
  {
    id: "recyclePerf",
    icon: "refresh-ccw",
    iconColor: "#7c3aed",
    iconBg: "#ede9fe",
    title: "Recycle Leads",
    subtitle: "Upload fresh platform data to attribute conversions",
    steps: [
      {
        title: "What this does",
        detail:
          "Tap Recycle Leads (Refresh Performance). Upload a fresh platform export. The app matches phone numbers to existing leads and updates their deposit and bet data.",
      },
      {
        title: "Attribution",
        detail:
          "A deposit is attributed to an agent only if the customer logged in on the platform AFTER our last call to them. This prevents crediting agents for pre-existing deposits.",
      },
      {
        title: "Conversions",
        detail:
          "Leads marked as Interested or Promised that then made an attributable deposit are automatically promoted to Converted. You'll see the count in the results summary.",
      },
    ],
  },
  {
    id: "approve",
    icon: "user-check",
    iconColor: "#d97706",
    iconBg: "#fef3c7",
    title: "Approving Agents",
    subtitle: "Onboard new team members",
    steps: [
      {
        title: "New agent signs up",
        detail:
          "When a new agent installs the app and registers, they get Pending status and cannot log in until you approve them.",
      },
      {
        title: "Approve in the app",
        detail:
          "Tap Approve Agents in the drawer. You'll see a list of pending agents. Tap Approve next to each one. They will immediately be able to log in.",
      },
      {
        title: "Reject an agent",
        detail:
          "If someone signed up in error, tap Reject. They will be removed from the pending list and cannot access the system.",
      },
    ],
  },
  {
    id: "tips",
    icon: "star",
    iconColor: "#b45309",
    iconBg: "#fef3c7",
    title: "Best Practices",
    subtitle: "Tips for running a high-performing team",
    steps: [
      {
        title: "Import leads daily",
        detail:
          "Fresh exports have the most accurate deposit data. Importing daily ensures your agents always have up-to-date lead information and accurate lead scores.",
      },
      {
        title: "Run a Performance Refresh after every campaign",
        detail:
          "After a calling campaign ends, upload a fresh platform export in Recycle Leads. This generates attributed revenue data that feeds your analytics and proves ROI.",
      },
      {
        title: "Balance agent loads",
        detail:
          "When assigning leads, check the agent load shown next to each agent's name (number of leads assigned). Assign more High Staker leads to your best-performing agents.",
      },
    ],
  },
];

// ─── Accordion item ───────────────────────────────────────────────────────────
function AccordionSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(o => !o);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={toggle} activeOpacity={0.7}>
        <View style={[styles.iconBox, { backgroundColor: section.iconBg }]}>
          <Feather name={section.icon} size={18} color={section.iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionSub} numberOfLines={1}>{section.subtitle}</Text>
        </View>
        <Feather
          name={open ? "chevron-down" : "chevron-right"}
          size={18}
          color={colors.text.secondary}
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.stepsContainer}>
          {section.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: section.iconColor }]}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDetail}>{step.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HelpScreen() {
  const { user } = useAuth();
  const isManager = user?.role === "management" || user?.role === "admin";
  const sections = isManager ? MANAGER_SECTIONS : AGENT_SECTIONS;
  const title = isManager ? "Manager Help" : "Agent Help";
  const tip = isManager
    ? "Daily workflow: Import Leads → Assign to agents → Recycle Leads after campaigns."
    : "Daily checklist: Check Callbacks → Call your queue → Log every disposition.";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Feather name="book-open" size={24} color={colors.brand.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>
            {isManager
              ? "Step-by-step guides for everything in your manager dashboard."
              : "Everything you need to know to succeed as an agent."}
          </Text>
        </View>
      </View>

      {/* Tip banner */}
      <View style={styles.tipBanner}>
        <Feather name="star" size={14} color="#92400e" style={{ marginTop: 1 }} />
        <Text style={styles.tipText}>
          <Text style={styles.tipBold}>Tip: </Text>
          {tip}
        </Text>
      </View>

      {/* Sections */}
      <View style={styles.list}>
        {sections.map(s => (
          <AccordionSection key={s.id} section={s} />
        ))}
      </View>

      <Text style={styles.footer}>
        Need more help? {isManager ? "Contact your system administrator." : "Contact your manager."}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 20, paddingBottom: 12 },
  headerIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#ecfdf5", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.text.primary },
  headerSub: { fontSize: 13, color: colors.text.secondary, marginTop: 3, lineHeight: 18 },
  tipBanner: { flexDirection: "row", gap: 8, backgroundColor: "#fef3c7", marginHorizontal: 16, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#fde68a", marginBottom: 8 },
  tipText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 19 },
  tipBold: { fontWeight: "700" },
  list: { paddingHorizontal: 16, gap: 10, marginTop: 6 },
  card: { backgroundColor: colors.bg.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border.default, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text.primary },
  sectionSub: { fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  stepsContainer: { borderTopWidth: 1, borderTopColor: colors.border.default, paddingHorizontal: 14, paddingVertical: 6 },
  step: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.default + "80" },
  stepNumber: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 },
  stepNum: { color: "#fff", fontSize: 11, fontWeight: "800" },
  stepTitle: { fontSize: 13, fontWeight: "700", color: colors.text.primary, marginBottom: 4 },
  stepDetail: { fontSize: 13, color: colors.text.secondary, lineHeight: 19 },
  footer: { textAlign: "center", fontSize: 12, color: colors.text.muted, marginTop: 20, paddingHorizontal: 20 },
});
