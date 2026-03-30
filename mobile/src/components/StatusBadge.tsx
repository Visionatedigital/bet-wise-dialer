import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  ...colors.leadStatus,
  pending: { bg: "#fef3c7", text: "#92400e" },
  ...colors.priority,
  ...colors.segment,
};

export function StatusBadge({ label }: { label: string }) {
  const style = BADGE_STYLES[label] || { bg: colors.bg.muted, text: colors.text.secondary };
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.text }]}>
        {label?.replace(/_/g, " ").toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
