import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, RefreshControl, FlatList, Modal, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAgentsAvailable } from "../../src/hooks/useDistribution";
import { api } from "../../src/api/client";
import { colors } from "../../src/theme/colors";

interface ManageLead {
  id: string;
  phone?: string;
  name?: string;
  status?: string;
  lifecycle_stage?: string;
  last_contact_at?: string;
  created_at?: string;
  assigned_agent_name?: string;
  user_id?: string | null;
  cooldown_until?: string | null;
  lead_score?: number;
  score?: number;
}

interface AgentOption {
  id: string;
  full_name: string;
  email: string;
  assigned_leads: string | number;
  status?: string;
}

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

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "interested", label: "Interested" },
  { key: "no_answer", label: "No Answer" },
  { key: "unreachable", label: "Unreachable" },
  { key: "not_interested", label: "Not Int." },
  { key: "new", label: "New" },
];

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

function buildLeadUrl(agentFilter: string | null, statusFilter: string, offset: number): string {
  let url = `/leads?limit=50&offset=${offset}`;
  if (agentFilter === "unassigned") url += "&user_id=unassigned";
  else if (agentFilter) url += `&user_id=${agentFilter}`;
  if (statusFilter === "new") url += "&lifecycle_stage=new";
  else if (statusFilter !== "all") url += `&status=${statusFilter}`;
  return url;
}

export default function ManageLeadsScreen() {
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [allLeads, setAllLeads] = useState<ManageLead[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"filter" | "assign">("filter");
  const [assigning, setAssigning] = useState(false);

  const queryClient = useQueryClient();
  const { data: agents } = useAgentsAvailable();

  const PAGE_SIZE = 50;

  const { data: pageLeads, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["manage-leads", agentFilter, statusFilter, offset],
    queryFn: () => api.get<ManageLead[]>(buildLeadUrl(agentFilter, statusFilter, offset)),
    staleTime: 10000,
  });

  // Reset when filters change
  useEffect(() => {
    setAllLeads([]);
    setOffset(0);
    setHasMore(true);
    setSelected(new Set());
  }, [agentFilter, statusFilter]);

  // Accumulate pages
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
      queryClient.invalidateQueries({ queryKey: ["agents-available"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-stats"] });
      Alert.alert("Done", res.message);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to assign leads");
    } finally {
      setAssigning(false);
    }
  };

  const currentAgentLabel =
    agentFilter === "unassigned"
      ? "Unassigned"
      : agentFilter
      ? agents?.find((a) => a.id === agentFilter)?.full_name || "Agent"
      : "All Agents";

  const onRefresh = () => {
    setOffset(0);
    queryClient.invalidateQueries({ queryKey: ["manage-leads", agentFilter, statusFilter, 0] });
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
          onLongPress={() => toggleSelect(item.id)}
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
                <Text style={styles.leadAgent} numberOfLines={1}>
                  <Feather name="user" size={10} color={colors.text.muted} /> {item.assigned_agent_name}
                </Text>
              ) : (
                <Text style={styles.leadUnassigned}>Unassigned</Text>
              )}
              <Text style={styles.leadTime}>{timeAgo(lastContact)} ago</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [selected, toggleSelect]
  );

  const ListHeader = (
    <View>
      {/* Agent filter */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={styles.agentFilterBtn}
          onPress={() => {
            setPickerMode("filter");
            setShowAgentPicker(true);
          }}
          activeOpacity={0.8}
        >
          <Feather name="users" size={14} color={colors.brand.dark} />
          <Text style={styles.agentFilterText} numberOfLines={1}>{currentAgentLabel}</Text>
          <Feather name="chevron-down" size={14} color={colors.brand.dark} />
        </TouchableOpacity>
        <View style={styles.leadCount}>
          <Text style={styles.leadCountText}>{allLeads.length} leads</Text>
        </View>
      </View>

      {/* Status chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContainer}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, statusFilter === f.key && styles.chipActive]}
            onPress={() => setStatusFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, statusFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Select all bar */}
      {allLeads.length > 0 && (
        <View style={styles.selectBar}>
          <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn} activeOpacity={0.7}>
            <View style={[styles.checkbox, selected.size === allLeads.length && selected.size > 0 && styles.checkboxSelected]}>
              {selected.size === allLeads.length && allLeads.length > 0 && <Feather name="check" size={11} color="#fff" />}
            </View>
            <Text style={styles.selectAllText}>
              {selected.size === allLeads.length && allLeads.length > 0 ? "Deselect All" : "Select All"}
            </Text>
          </TouchableOpacity>
          {selected.size > 0 && (
            <Text style={styles.selectedCount}>{selected.size} selected</Text>
          )}
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
              <Text style={styles.emptyText}>No leads found</Text>
              <Text style={styles.emptySubText}>Try changing the filter</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={isFetching && offset === 0} onRefresh={onRefresh} tintColor={colors.brand.green} />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Floating action bar */}
      {selected.size > 0 && (
        <View style={styles.actionBar}>
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
            onPress={() => {
              setPickerMode("assign");
              setShowAgentPicker(true);
            }}
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

      {/* Agent picker modal (filter OR assign) */}
      <Modal visible={showAgentPicker} transparent animationType="slide" onRequestClose={() => setShowAgentPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAgentPicker(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {pickerMode === "filter" ? "Filter by Agent" : `Assign ${selected.size} Lead${selected.size === 1 ? "" : "s"} to`}
            </Text>
            <TouchableOpacity onPress={() => setShowAgentPicker(false)}>
              <Feather name="x" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Filter-mode options: All + Unassigned */}
          {pickerMode === "filter" && (
            <>
              <TouchableOpacity
                style={[styles.agentOption, agentFilter === null && styles.agentOptionSelected]}
                onPress={() => { setAgentFilter(null); setShowAgentPicker(false); }}
                activeOpacity={0.7}
              >
                <View style={styles.agentOptionAvatar}>
                  <Feather name="globe" size={14} color="#fff" />
                </View>
                <Text style={styles.agentOptionName}>All Agents</Text>
                {agentFilter === null && <Feather name="check" size={16} color={colors.brand.green} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.agentOption, agentFilter === "unassigned" && styles.agentOptionSelected]}
                onPress={() => { setAgentFilter("unassigned"); setShowAgentPicker(false); }}
                activeOpacity={0.7}
              >
                <View style={[styles.agentOptionAvatar, { backgroundColor: "#6b7280" }]}>
                  <Feather name="user-x" size={14} color="#fff" />
                </View>
                <Text style={styles.agentOptionName}>Unassigned</Text>
                {agentFilter === "unassigned" && <Feather name="check" size={16} color={colors.brand.green} />}
              </TouchableOpacity>
              <View style={styles.divider} />
            </>
          )}

          <ScrollView>
            {!agents || agents.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No agents in your country</Text>
              </View>
            ) : (
              agents.map((agent) => {
                const initials = (agent.full_name || agent.email || "?")
                  .split(" ")
                  .map((w: string) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const isActive = pickerMode === "filter" && agentFilter === agent.id;
                return (
                  <TouchableOpacity
                    key={agent.id}
                    style={[styles.agentOption, isActive && styles.agentOptionSelected]}
                    onPress={() => {
                      if (pickerMode === "filter") {
                        setAgentFilter(agent.id);
                        setShowAgentPicker(false);
                      } else {
                        setShowAgentPicker(false);
                        Alert.alert(
                          "Assign Leads",
                          `Assign ${selected.size} lead${selected.size === 1 ? "" : "s"} to ${agent.full_name}?`,
                          [
                            { text: "Cancel", style: "cancel" },
                            { text: "Assign", onPress: () => handleAssign(agent.id) },
                          ]
                        );
                      }
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
                    {isActive && <Feather name="check" size={16} color={colors.brand.green} />}
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

  // Filter row
  filterRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 10 },
  agentFilterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.brand.dark,
  },
  agentFilterText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.brand.dark },
  leadCount: { paddingHorizontal: 10, paddingVertical: 10 },
  leadCountText: { fontSize: 12, color: colors.text.muted, fontWeight: "500" },

  // Status chips
  chipsScroll: { flexGrow: 0 },
  chipsContainer: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default },
  chipActive: { backgroundColor: colors.brand.dark, borderColor: colors.brand.dark },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.text.secondary },
  chipTextActive: { color: colors.brand.yellow },

  // Select all bar
  selectBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, justifyContent: "space-between" },
  selectAllBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectAllText: { fontSize: 13, color: colors.text.secondary, fontWeight: "600" },
  selectedCount: { fontSize: 13, fontWeight: "700", color: colors.brand.green },

  // Lead cards
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
  leadBottomRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  leadAgent: { fontSize: 12, color: colors.text.muted, flex: 1 },
  leadUnassigned: { fontSize: 12, color: colors.text.muted, fontStyle: "italic", flex: 1 },
  leadTime: { fontSize: 11, color: colors.text.muted },

  // Load more
  loadMoreBtn: { marginHorizontal: 16, marginTop: 6, padding: 12, borderRadius: 8, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default, alignItems: "center" },
  loadMoreText: { fontSize: 13, fontWeight: "600", color: colors.brand.green },

  // Empty
  emptyBox: { alignItems: "center", padding: 40 },
  emptyText: { fontSize: 15, color: colors.text.secondary, fontWeight: "600", marginTop: 12 },
  emptySubText: { fontSize: 13, color: colors.text.muted, marginTop: 4 },

  // Floating action bar
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
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

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingTop: 8,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.text.primary },
  agentOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  agentOptionSelected: { backgroundColor: "#f0fdf4" },
  agentOptionAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  agentOptionAvatarText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  agentOptionName: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  agentOptionMeta: { fontSize: 12, color: colors.text.muted, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.border.default, marginHorizontal: 20, marginVertical: 4 },
});
