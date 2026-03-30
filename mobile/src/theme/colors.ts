// BangBet brand colors — exact match from desktop CSS variables (light mode)
export const colors = {
  // Brand
  brand: {
    yellow: "#FFE600",
    yellowDark: "#E6CF00",
    green: "#00963f",
    greenLight: "#22c55e",
    greenHover: "#16a34a",
    dark: "#333333",
  },

  // Backgrounds (light mode from CSS --background: 0 0% 100%)
  bg: {
    primary: "#ffffff",         // --background
    dashboard: "#f8fafc",       // --dashboard-bg hsl(218 11% 97%)
    card: "#ffffff",            // --card
    sidebar: "#FFE600",         // sidebar bg
    muted: "#f1f5f9",          // --muted hsl(220 14% 96%)
    accent: "#ecfdf5",          // --accent hsl(160 40% 95%) — green tint
  },

  // Text (from CSS --foreground: 220 13% 18%)
  text: {
    primary: "#2d3748",         // --foreground
    secondary: "#64748b",       // --muted-foreground
    muted: "#94a3b8",
    white: "#ffffff",
    sidebar: "#333333",
    sidebarMuted: "rgba(51,51,51,0.5)",
  },

  // Borders (from CSS --border: 220 13% 91%)
  border: {
    default: "#e2e8f0",         // --border
    sidebar: "#E6CF00",
    input: "#e2e8f0",           // --input
  },

  // Status (from CSS)
  status: {
    success: "#22c55e",         // --success hsl(142 71% 45%)
    warning: "#f59e0b",         // --warning hsl(38 92% 50%)
    error: "#ef4444",           // --destructive hsl(0 72% 51%)
    info: "#3b82f6",            // --info hsl(221 83% 53%)
  },

  // Lead status — pastel backgrounds
  leadStatus: {
    interested: { bg: "#dcfce7", text: "#166534" },
    not_interested: { bg: "#fee2e2", text: "#991b1b" },
    no_answer: { bg: "#fef3c7", text: "#92400e" },
    unreachable: { bg: "#f3f4f6", text: "#374151" },
    unassigned: { bg: "#e0e7ff", text: "#3730a3" },
  },

  // Segments — pastel
  segment: {
    vip: { bg: "#fef3c7", text: "#92400e" },
    "semi-active": { bg: "#e0e7ff", text: "#3730a3" },
    dormant: { bg: "#f3f4f6", text: "#6b7280" },
  },

  // Priority — pastel
  priority: {
    high: { bg: "#fee2e2", text: "#991b1b" },
    medium: { bg: "#fef3c7", text: "#92400e" },
    low: { bg: "#dcfce7", text: "#166534" },
  },
};
