import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Image } from "react-native";
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
      style={styles.contactItem}
      onPress={() => router.push(`/crm-lead/${item.id}`)}
    >
      <View style={styles.avatarWrapper}>
        <Image 
          source={{ uri: `https://picsum.photos/seed/${item.phone}/100` }} 
          style={styles.avatar} 
        />
        <View style={[styles.statusDot, { backgroundColor: item.vip_level === 'VIP' || item.segment === 'vip' ? "#FFE600" : "#22c55e" }]} />
      </View>

      <View style={styles.contactInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
          {(item.vip_level === 'VIP' || item.segment === 'vip') && (
            <View style={styles.vipMiniBadge}>
              <Text style={styles.vipMiniBadgeText}>VIP</Text>
            </View>
          )}
        </View>
        <Text style={styles.contactPhone}>{item.phone}</Text>
      </View>

      <View style={styles.metaInfo}>
        <Text style={styles.lastActiveText}>
          {item.last_login_at ? new Date(item.last_login_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Never'}
        </Text>
        <Feather name="chevron-right" size={16} color="#cbd5e1" />
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
  container: { flex: 1, backgroundColor: "#fffef0" },
  header: { padding: 20, backgroundColor: "#064e3b" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, color: "#fff", fontWeight: "500" },
  filterTabs: { backgroundColor: "#064e3b", paddingBottom: 16 },
  filterScroll: { paddingHorizontal: 16 },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  activeFilterTab: { backgroundColor: "#FFE600", borderColor: "#FFE600" },
  filterLabel: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.6)" },
  activeFilterLabel: { color: "#000" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingVertical: 10 },
  contactItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 14,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  vipMiniBadge: {
    backgroundColor: '#FFE600',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  vipMiniBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#000',
  },
  contactPhone: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lastActiveText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 100 },
  emptyText: { marginTop: 12, fontSize: 14, color: "#64748b", fontWeight: "600" },
});
