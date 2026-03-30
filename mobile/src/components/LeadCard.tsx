import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Lead } from "../types";
import { StatusBadge } from "./StatusBadge";
import { colors } from "../theme/colors";

interface Props {
  lead: Lead;
  onPress: () => void;
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone || "";
  return phone.slice(0, 4) + "****" + phone.slice(-2);
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function LeadCard({ lead, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(lead.name || "?")[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{lead.name}</Text>
          <Text style={styles.phone}>{maskPhone(lead.phone)}</Text>
        </View>
        <View style={styles.right}>
          <StatusBadge label={lead.status || "unassigned"} />
          {lead.last_contact_at && (
            <Text style={styles.time}>{timeAgo(lead.last_contact_at)}</Text>
          )}
        </View>
      </View>
      {lead.last_activity && (
        <Text style={styles.activity} numberOfLines={1}>{lead.last_activity}</Text>
      )}
      <View style={styles.tags}>
        <StatusBadge label={lead.segment || "general"} />
        <StatusBadge label={lead.priority} />
        {lead.campaign_name && (
          <Text style={styles.campaign} numberOfLines={1}>{lead.campaign_name}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: 8,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  row: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.brand.green,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: colors.text.white, fontSize: 15, fontWeight: "700" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  phone: { fontSize: 13, color: colors.text.secondary, marginTop: 1 },
  right: { alignItems: "flex-end", gap: 4 },
  time: { fontSize: 11, color: colors.text.muted, marginTop: 2 },
  activity: { fontSize: 12, color: colors.text.secondary, marginTop: 8, fontStyle: "italic" },
  tags: { flexDirection: "row", gap: 6, marginTop: 8, alignItems: "center" },
  campaign: { fontSize: 11, color: colors.text.muted, marginLeft: 4 },
});
