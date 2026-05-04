import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors } from "../../src/theme/colors";
import { useCrmContacts } from "../../src/hooks/useCrm";
import { Lead } from "../../src/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "vip", label: "VIP" },
  { id: "hot", label: "Hot Leads" },
  { id: "at_risk", label: "At Risk" },
  { id: "needs_follow_up", label: "Follow-up" },
  { id: "no_response", label: "No Response" },
  { id: "converted", label: "Converted" },
  { id: "escalations", label: "Escalated" },
];

export default function ContactsScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: contacts, isLoading, refetch } = useCrmContacts(activeFilter);

  const filteredContacts = (contacts || []).filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const renderContactItem = ({ item }: { item: Lead }) => (
    <TouchableOpacity
      style={styles.contactCard}
      onPress={() => router.push(`/contacts/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.nameContainer}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>{item.phone}</Text>
        </View>
        <View style={styles.tagsRow}>
          {item.vip_level && (
            <View style={[styles.tag, { backgroundColor: colors.brand.yellow }]}>
              <Text style={styles.tagText}>{item.vip_level}</Text>
            </View>
          )}
          {item.risk_status && (
            <View style={[styles.tag, { backgroundColor: item.risk_status === 'At Risk' ? colors.status.error : colors.status.warning }]}>
              <Text style={[styles.tagText, { color: '#fff' }]}>{item.risk_status}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Last Login</Text>
            <Text style={styles.infoValue}>
              {item.last_login_at ? new Date(item.last_login_at).toLocaleDateString() : 'Never'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Last Deposit</Text>
            <Text style={styles.infoValue}>
              {item.last_deposit_ugx ? `UGX ${item.last_deposit_ugx.toLocaleString()}` : '—'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Product</Text>
            <Text style={styles.infoValue}>{item.favourite_game || item.preferred_product || 'General'}</Text>
          </View>
        </View>

        {item.next_action && (
          <View style={styles.nextActionContainer}>
            <Feather name="arrow-right-circle" size={14} color={colors.brand.green} />
            <Text style={styles.nextActionText}>Next: {item.next_action}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: colors.brand.green }]}
          onPress={() => Linking.openURL(`tel:${item.phone}`)}
        >
          <Feather name="phone" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: '#25D366' }]}
          onPress={() => router.push(`/contacts/${item.id}?tab=whatsapp`)}
        >
          <Feather name="message-circle" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={colors.text.secondary} />
          <TextInput
            placeholder="Search contacts..."
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.filterTabs}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filterScroll}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === item.id && styles.activeFilterTab,
              ]}
              onPress={() => setActiveFilter(item.id)}
            >
              <Text
                style={[
                  styles.filterLabel,
                  activeFilter === item.id && styles.activeFilterLabel,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand.dark} />
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContactItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={colors.border.default} />
              <Text style={styles.emptyText}>No contacts found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  header: { padding: 16, backgroundColor: colors.bg.card },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.dashboard,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: colors.text.primary },
  filterTabs: { backgroundColor: colors.bg.card, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  filterScroll: { paddingHorizontal: 12, paddingBottom: 12 },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bg.dashboard,
    marginRight: 8,
  },
  activeFilterTab: { backgroundColor: colors.brand.dark },
  filterLabel: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },
  activeFilterLabel: { color: colors.brand.yellow },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16 },
  contactCard: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  nameContainer: { flex: 1 },
  contactName: { fontSize: 17, fontWeight: "700", color: colors.text.primary },
  contactPhone: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  tagsRow: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: "800", color: colors.brand.dark },
  cardBody: { borderTopWidth: 1, borderTopColor: colors.border.default, paddingTop: 12, paddingBottom: 12 },
  infoGrid: { flexDirection: "row", justifyContent: "space-between" },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 11, color: colors.text.secondary, marginBottom: 4 },
  infoValue: { fontSize: 13, fontWeight: "600", color: colors.text.primary },
  nextActionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    backgroundColor: "rgba(0,166,81,0.05)",
    padding: 8,
    borderRadius: 8,
  },
  nextActionText: { fontSize: 12, fontWeight: "600", color: colors.brand.green },
  cardActions: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 100 },
  emptyText: { marginTop: 12, fontSize: 16, color: colors.text.secondary, fontWeight: "500" },
});
