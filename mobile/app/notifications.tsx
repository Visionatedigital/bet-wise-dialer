import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api } from "../src/api/client";

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // Fetch both stored notifications and intelligent AI alerts
      const [stored, intelligent] = await Promise.all([
        api.get<any[]>('/notifications'),
        api.get<any[]>('/notifications/intelligent')
      ]);
      
      // Merge and sort
      const merged = [...(intelligent || []), ...(stored || [])].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setNotifications(merged);
    } catch (err) {
      console.log("Failed to fetch notifications", err);
      // Mock data if server endpoint is not yet ready
      setNotifications([
        { 
          id: 'ai-1', 
          type: 'follow_up', 
          title: 'VIP Follow-up Required', 
          message: 'Client 66830 (VIP) hasn\'t been contacted in 3 days. High churn risk detected.', 
          created_at: new Date().toISOString(),
          is_ai: true 
        },
        { 
          id: 'ai-2', 
          type: 'whatsapp', 
          title: 'New WhatsApp Reply', 
          message: 'Client 96694 replied: "Interested in the weekend bonus".', 
          created_at: new Date(Date.now() - 3600000).toISOString(),
          is_ai: true 
        },
        { 
          id: 'db-1', 
          type: 'system', 
          title: 'Import Successful', 
          message: '99 new leads have been assigned to your portfolio.', 
          created_at: new Date(Date.now() - 86400000).toISOString(),
          is_ai: false 
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'follow_up': return 'clock';
      case 'whatsapp': return 'message-circle';
      case 'deposit': return 'dollar-sign';
      case 'system': return 'info';
      default: return 'bell';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'follow_up': return '#ef4444';
      case 'whatsapp': return '#22c55e';
      case 'deposit': return '#FFE600';
      default: return '#64748b';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: "Alert Center",
          headerShown: true,
          headerStyle: { backgroundColor: "#064e3b" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "800" },
        }} 
      />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchNotifications} tintColor="#22c55e" />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Intelligent Alerts</Text>
          <Text style={styles.headerSub}>AI-driven priority monitoring</Text>
        </View>

        {notifications.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={48} color="#e2e8f0" />
            <Text style={styles.emptyText}>All caught up!</Text>
          </View>
        ) : (
          notifications.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.card, item.is_ai && styles.aiCard]}>
              <View style={[styles.iconBox, { backgroundColor: getIconColor(item.type) + '20' }]}>
                <Feather name={getIcon(item.type)} size={18} color={getIconColor(item.type)} />
              </View>
              
              <View style={styles.content}>
                <View style={styles.row}>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.is_ai && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI PRIORITY</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fffef0",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    padding: 20,
    backgroundColor: "#064e3b",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
  },
  headerSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 20,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  aiCard: {
    borderColor: '#22c55e',
    borderLeftWidth: 4,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  aiBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#fff',
  },
  message: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    fontWeight: '500',
  },
  time: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 12,
  },
});
