import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, RefreshControl, FlatList, Modal, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAgentsAvailable } from "../../src/hooks/useDistribution";
import { api } from "../../src/api/client";
import { colors } from "../../src/theme/colors";

interface ManageLead {
  id: string;
  phone?: string;
  status?: string;
  lifecycle_stage?: string;
  last_contact_at?: string;
  created_at?: string;
  assigned_agent_name?: string;
  user_id?: string | null;
  cooldown_until?: string | null;
}

interface CategoryCounts {
  high_staker: number;
  medium_staker: number;
  frequent_bettor: number;
  active: number;
  dormant: number;
  pipeline: number;
  unassigned: number;
  total: number;
}

const CATEGORIES = [
  {
    id: "high_staker",
    title: "High Stakers",
    description: "Top depositors",
    bg: "#fee2e2", text: "#991b1b", border: "#fecaca", dot: "#ef4444",
    icon: "trending-up" as const,
    queryParam: "trait=High%20Staker",
    countKey: "high_staker" as keyof CategoryCounts,
  },
  {
    id: "medium_staker",
    title: "Medium Stakers",
    description: "Moderate depositors",
    bg: "#fef3c7", text: "#92400e", border: "#fde68a", dot: "#f59e0b",
    icon: "bar-chart-2" as const,
    queryParam: "trait=Medium%20Staker",
    countKey: "medium_staker" as keyof CategoryCounts,
  },
  {
    id: "frequent_bettor",
    title: "Frequent Bettors",
    description: "High bet volume",
    bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe", dot: "#3b82f6",
    icon: "repeat" as const,
    queryParam: "trait=Frequent%20Bettor",
    countKey: "frequent_bettor" as keyof CategoryCounts,
  },
  {
    id: "dormant",
    title: "Dormant",
    description: "Inactive players",
    bg: "#f3f4f6", text: "#374151", border: "#e5e7eb", dot: "#9ca3af",
    icon: "moon" as const,
    queryParam: "trait=Dormant",
    countKey: "dormant" as keyof CategoryCounts,
  },
  {
    id: "pipeline",
    title: "Hot Pipeline",
    description: "Interested or promised",
    bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", dot: "#10b981",
    icon: "zap" as const,
    queryParam: "lifecycle_stage=pipeline",
    countKey: "pipeline" as keyof CategoryCounts,
  },
  {
    id: "unassigned",
    title: "New / Unassigned",
    description: "Not yet assigned",
    bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6",
    icon: "user-plus" as const,
    queryParam: "user_id=unassigned",
    countKey: "unassigned" as keyof CategoryCounts,
  },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  interested: { label: "Interested", bg: "#dcfce7", text: "#166534" },
  promised: { label: "Promised", bg: "#d1fae5", text: "#065f46" },
  converted: { label: "Converted", bg: "#bbf7d0", text: "#14532d" },
  no_answer: { label: "No Answer", bg: "#fef3c7", text: "#92400e" },
  answered_no_response: { label: "No Response", bg: "#fef9c3", text: "#713f12" },
  unreachable: { label: "Unreachable", bg: "#fee2e2", text: "#991b1b" },
  not_interested: { label: "Not Interested", bg: "#f3f4f6", text: "#374151" },
  new: { label: "New", bg: "#e0f2fe", text: "#0369a1" },
  dead: { label: "Dead", bg: "#f1f5f9", text: "#64748b" },
};

function maskPhone(phone: string): string {
  if (!phone) return "—";
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 6) return phone;
  return phone.slice(0, Math.max(0, phone.length - 4)).replace(/\d/g, "*") + digits.slice(-4);
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function ManageLeadsScreen() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [allLeads, setAllLeads] = useState<ManageLead[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const queryClient = useQueryClient();
  const { data: agents } = useAgentsAvailable();
  const insets = useSafeAreaInsets();
  const PAGE_SIZE = 50;

  const { data: counts, refetch: refetchCounts } = useQuery({
    queryKey: ["category-counts"],
    queryFn: () => api.get<CategoryCounts>("/leads/category-counts"),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const activeCat = CATEGORIES.find((c) => c.id === activeCategory);

  const { data: pageLeads, isLoading, isFetching, refetch: refetchLeads } = useQuery({
    queryKey: ["manage-leads", activeCategory, offset],
    queryFn: () => {
      if (!activeCat) return Promise.resolve([] as ManageLead[]);
      return api.get<ManageLead[]>(`/leads?limit=50&offset=${offset}&${activeCat.queryParam}`);
    },
    enabled: !!activeCategory,
    staleTime: 10000,
  });

  useEffect(() => {
    setAllLeads([]);
    setOffset(0);
    setHasMore(true);
    setSelected(new Set());
  }, [activeCategory]);

  useEffect(() => {
    if (!pageLeads) return;
    if (offset === 0) {
      setAllLeads(pageLeads);
    } else {
      setAllLeads((prev) => [...prev, ...pageLeads]);
    }
    setHasMore(pageLeads.length === PAGE_SIZE);
  }, [pageLeads, offset]);

  const loadMore = () => {
    if (!hasMore || isFetching) return;
    setOffset((prev) => prev + PAGE_SIZE);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (selected.size === allLeads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allLeads.map((l) => l.id)));
    }
  };

  const handleAssign = async (targetAgentId: string | null) => {
    const leadIds = Array.from(selected);
    if (leadIds.length === 0) return;
    setAssigning(true);
    setShowAgentPicker(false);
    try {
      const res = await api.post<{ message: string; updated: number }>("/leads/bulk-assign", {
        lead_ids: leadIds,
        agent_id: targetAgentId,
      });
      setSelected(new Set());
      setOffset(0);
      queryClient.invalidateQueries({ queryKey: ["manage-leads"] });
      queryClient.invalidateQueries({ queryKey: ["category-counts"] });
      queryClient.invalidateQueries({ queryKey: ["agents-available"] });
      Alert.alert("Done", res.message);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to assign leads");
    } finally {
      setAssigning(false);
    }
  };

  const renderLead = useCallback(
    ({ item }: { item: ManageLead }) => {
      const isSelected = selected.has(item.id);
      const sc = STATUS_CONFIG[item.status || item.lifecycle_stage || "new"] || STATUS_CONFIG.new;
      const hasActiveCooldown = item.cooldown_until && new Date(item.cooldown_until) > new Date();
      const lastContact = item.last_contact_at || item.created_at;

      return (
        <TouchableOpacity
          style={[styles.leadCard, isSelected && styles.leadCardSelected]}
          activeOpacity={0.7}
          onPress={() => toggleSelect(item.id)}
        >
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Feather name="check" size={11} color="#fff" />}
          </View>
          <View style={styles.leadInfo}>
            <View style={styles.leadTopRow}>
              <Text style={styles.leadPhone}>{maskPhone(item.phone || "")}</Text>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusBadgeText, { color: sc.text }]}>{sc.label}</Text>
              </View>
              {hasActiveCooldown && (
                <View style={styles.cooldownBadge}>
                  <Feather name="clock" size={9} color="#92400e" />
                  <Text style={styles.cooldownText}>cooldown</Text>
                </View>
              )}
            </View>
            <View style={styles.leadBottomRow}>
              {item.assigned_agent_name ? (
                <Text style={styles.leadAgent} numberOfLines={1}>{item.assigned_agent_name}</Text>
              ) : (
                <Text style={styles.leadUnassigned}>Unassigned</Text>
              )}
              <Text style={styles.leadTime}>{timeAgo(lastContact)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [selected, toggleSelect]
  );

  // ── Category overview ──────────────────────────────────────────────────────
  if (!activeCategory) {
    return (
      <View style={styles.container}>
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewTotal}>
            {counts?.total != null ? Number(counts.total).toLocaleString() : "—"} leads total
          </Text>
          <Text style={styles.overviewSub}>Tap a category to view and assign leads</Text>
        </View>
        <FlatList
          data={CATEGORIES}
          keyExtractor={(c) => c.id}
          numColumns={2}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetchCounts()} tintColor={colors.brand.green} />}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          columnWrapperStyle={{ gap: 10 }}
          renderItem={({ item }) => {
            const count = counts != null ? Number(counts[item.countKey] ?? 0) : null;
            return (
              <TouchableOpacity
                style={[styles.categoryCard, { backgroundColor: item.bg, borderColor: item.border }]}
                onPress={() => setActiveCategory(item.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.categoryIconWrap, { backgroundColor: item.dot + "22" }]}>
                  <Feather name={item.icon} size={18} color={item.dot} />
                </View>
                <Text style={[styles.categoryCount, { color: item.text }]}>
                  {count != null ? count.toLocaleString() : "—"}
                </Text>
                <Text style={[styles.categoryTitle, { color: item.text }]}>{item.title}</Text>
                <Text style={[styles.categoryDesc, { color: item.text + "99" }]}>{item.description}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  // ── Lead list within a category ────────────────────────────────────────────
  const cat = activeCat!;

  const ListHeader = (
    <View>
      {allLeads.length > 0 && (
        <View style={styles.selectBar}>
          <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn} activeOpacity={0.7}>
            <View style={[styles.checkbox, selected.size === allLeads.length && allLeads.length > 0 && styles.checkboxSelected]}>
              {selected.size === allLeads.length && allLeads.length > 0 && <Feather name="check" size={11} color="#fff" />}
            </View>
            <Text style={styles.selectAllText}>
              {selected.size === allLeads.length && allLeads.length > 0 ? "Deselect All" : "Select All"}
            </Text>
          </TouchableOpacity>
          <Text style={selected.size > 0 ? styles.selectedCount : styles.leadCountText}>
            {selected.size > 0 ? `${selected.size} selected` : `${allLeads.length} leads`}
          </Text>
        </View>
      )}
    </View>
  );

  const ListFooter = (
    <View>
      {isFetching && offset > 0 && (
        <ActivityIndicator color={colors.brand.green} style={{ marginVertical: 16 }} />
      )}
      {hasMore && !isFetching && allLeads.length > 0 && (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} activeOpacity={0.7}>
          <Text style={styles.loadMoreText}>Load more</Text>
        </TouchableOpacity>
      )}
      <View style={{ height: selected.size > 0 ? 100 : 30 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.backHeader, { backgroundColor: cat.bg, borderBottomColor: cat.border }]}
        onPress={() => setActiveCategory(null)}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={18} color={cat.text} />
        <View style={[styles.catDot, { backgroundColor: cat.dot }]} />
        <Text style={[styles.backTitle, { color: cat.text }]}>{cat.title}</Text>
        {counts != null && (
          <View style={[styles.countBadge, { backgroundColor: "rgba(255,255,255,0.6)" }]}>
            <Text style={[styles.countBadgeText, { color: cat.text }]}>
              {Number(counts[cat.countKey] ?? 0).toLocaleString()}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {isLoading && offset === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.green} />
        </View>
      ) : (
        <FlatList
          data={allLeads}
          keyExtractor={(item) => item.id}
          renderItem={renderLead}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={28} color={colors.text.muted} />
              <Text style={styles.emptyText}>No leads in this category</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isFetching && offset === 0}
              onRefresh={() => { setOffset(0); refetchLeads(); }}
              tintColor={colors.brand.green}
            />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Floating action bar */}
      {selected.size > 0 && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.actionBarLeft}>
            <Text style={styles.actionBarCount}>{selected.size} selected</Text>
          </View>
          <TouchableOpacity
            style={styles.unassignBtn}
            onPress={() =>
              Alert.alert("Unassign Leads", `Unassign ${selected.size} leads?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Unassign", style: "destructive", onPress: () => handleAssign(null) },
              ])
            }
            disabled={assigning}
            activeOpacity={0.8}
          >
            <Feather name="user-minus" size={14} color="#991b1b" />
            <Text style={styles.unassignBtnText}>Unassign</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.assignBtn}
            onPress={() => setShowAgentPicker(true)}
            disabled={assigning}
            activeOpacity={0.8}
          >
            {assigning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="user-plus" size={14} color="#fff" />
                <Text style={styles.assignBtnText}>Assign to →</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Agent picker modal */}
      <Modal visible={showAgentPicker} transparent animationType="slide" onRequestClose={() => setShowAgentPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAgentPicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Assign {selected.size} Lead{selected.size === 1 ? "" : "s"} to
            </Text>
            <TouchableOpacity onPress={() => setShowAgentPicker(false)}>
              <Feather name="x" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {!agents || agents.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No agents in your country</Text>
              </View>
            ) : (
              agents.map((agent) => {
                const initials = (agent.full_name || agent.email || "?")
                  .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <TouchableOpacity
                    key={agent.id}
                    style={styles.agentOption}
                    onPress={() => {
                      setShowAgentPicker(false);
                      Alert.alert(
                        "Assign Leads",
                        `Assign ${selected.size} lead${selected.size === 1 ? "" : "s"} to ${agent.full_name}?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Assign", onPress: () => handleAssign(agent.id) },
                        ]
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.agentOptionAvatar, agent.status === "online" && { backgroundColor: "#16a34a" }]}>
                      <Text style={styles.agentOptionAvatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.agentOptionName}>{agent.full_name || agent.email}</Text>
                      <Text style={styles.agentOptionMeta}>{agent.assigned_leads} leads assigned</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },

  overviewHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  overviewTotal: { fontSize: 18, fontWeight: "800", color: colors.text.primary },
  overviewSub: { fontSize: 12, color: colors.text.muted, marginTop: 2 },

  categoryCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  categoryCount: { fontSize: 28, fontWeight: "800", lineHeight: 32 },
  categoryTitle: { fontSize: 13, fontWeight: "700", marginTop: 3 },
  categoryDesc: { fontSize: 11, fontWeight: "500", marginTop: 2 },

  backHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  backTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countBadgeText: { fontSize: 13, fontWeight: "800" },

  selectBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, justifyContent: "space-between" },
  selectAllBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectAllText: { fontSize: 13, color: colors.text.secondary, fontWeight: "600" },
  selectedCount: { fontSize: 13, fontWeight: "700", color: colors.brand.green },
  leadCountText: { fontSize: 12, color: colors.text.muted, fontWeight: "500" },

  leadCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.card,
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 10,
  },
  leadCardSelected: { borderColor: colors.brand.green, backgroundColor: "#f0fdf4" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxSelected: { backgroundColor: colors.brand.green, borderColor: colors.brand.green },
  leadInfo: { flex: 1, minWidth: 0 },
  leadTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  leadPhone: { fontSize: 14, fontWeight: "600", color: colors.text.primary, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, flexShrink: 0 },
  statusBadgeText: { fontSize: 10, fontWeight: "700" },
  cooldownBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  cooldownText: { fontSize: 9, fontWeight: "700", color: "#92400e" },
  leadBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  leadAgent: { fontSize: 12, color: colors.text.muted, flex: 1 },
  leadUnassigned: { fontSize: 12, color: colors.text.muted, fontStyle: "italic", flex: 1 },
  leadTime: { fontSize: 11, color: colors.text.muted },

  loadMoreBtn: { marginHorizontal: 16, marginTop: 6, padding: 12, borderRadius: 8, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default, alignItems: "center" },
  loadMoreText: { fontSize: 13, fontWeight: "600", color: colors.brand.green },

  emptyBox: { alignItems: "center", padding: 40 },
  emptyText: { fontSize: 15, color: colors.text.secondary, fontWeight: "600", marginTop: 12 },

  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.card,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  actionBarLeft: { flex: 1 },
  actionBarCount: { fontSize: 13, fontWeight: "700", color: colors.text.primary },
  unassignBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fee2e2", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8 },
  unassignBtnText: { fontSize: 13, fontWeight: "600", color: "#991b1b" },
  assignBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.brand.dark, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  assignBtnText: { fontSize: 13, fontWeight: "700", color: colors.brand.yellow },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: colors.bg.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%", paddingTop: 8 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.text.primary },
  agentOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  agentOptionAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  agentOptionAvatarText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  agentOptionName: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  agentOptionMeta: { fontSize: 12, color: colors.text.muted, marginTop: 1 },
});
