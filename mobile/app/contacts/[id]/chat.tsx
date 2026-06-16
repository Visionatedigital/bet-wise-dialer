import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../../src/theme/colors";
import { useLead } from "../../../src/hooks/useLeads";
import { api } from "../../../src/api/client";
import { useMutation, useQuery } from "@tanstack/react-query";

export default function WhatsAppChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: lead, isLoading: leadLoading } = useLead(id);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [whisperVisible, setWhisperVisible] = useState(true);
  const [whisper, setWhisper] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchWhisper = useMutation({
    mutationFn: () => api.post(`/ai/whisper`, { contact_id: id }),
    onSuccess: (data) => setWhisper(data),
  });

  useEffect(() => {
    if (id) fetchWhisper.mutate();
    // In a real app we would also fetch historical messages here.
  }, [id]);

  if (leadLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand.dark} />
      </View>
    );
  }

  const sendMessage = async () => {
    if (!lead) return;
    const textToSend = message.trim();
    if (!textToSend) return;
    
    // Add to UI immediately
    const newMessage = {
      id: Date.now().toString(),
      body: textToSend,
      direction: 'outbound',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
    setMessage("");

    try {
      await api.post('/whatsapp/send', {
        contact_id: id,
        phone: lead.phone,
        body: textToSend
      });
    } catch (error) {
      console.error("Failed to send WhatsApp message", error);
      // Ideally show a failure state for this message
    }
  };

  const renderMessage = ({ item }: any) => {
    const isInbound = item.direction === 'inbound';
    return (
      <View style={[styles.messageWrapper, isInbound ? styles.inboundWrapper : styles.outboundWrapper]}>
        <View style={[styles.messageBubble, isInbound ? styles.inboundBubble : styles.outboundBubble]}>
          <Text style={[styles.messageText, !isInbound && styles.outboundText]}>{item.body}</Text>
          <Text style={[styles.messageTime, !isInbound && styles.outboundTime]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen options={{ title: lead?.name || "Chat" }} />
      
      {/* Context Card (Expandable/Top) */}
      <View style={styles.contextCard}>
        <View style={styles.contextHeader}>
          <Text style={styles.contextTitle}>Relationship Context</Text>
          <View style={[styles.miniBadge, { backgroundColor: colors.brand.yellow }]}>
            <Text style={styles.miniBadgeText}>{lead?.vip_level || lead?.segment}</Text>
          </View>
        </View>
        <Text style={styles.contextSummary} numberOfLines={2}>
          VIP Client with recent withdrawal delay. Prefers direct, supportive communication.
        </Text>
      </View>

      {/* AI Whisper */}
      {whisperVisible && whisper && (
        <View style={styles.whisperCard}>
          <View style={styles.whisperHeader}>
            <View style={styles.whisperLabelRow}>
              <Feather name="zap" size={14} color={colors.brand.green} />
              <Text style={styles.whisperLabel}>AI WHISPER (Agent Only)</Text>
            </View>
            <TouchableOpacity onPress={() => setWhisperVisible(false)}>
              <Feather name="x" size={14} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.whisperText}>
            {whisper.whisper_text}
          </Text>
          <TouchableOpacity 
            style={styles.whisperAction}
            onPress={() => setMessage(whisper.whisper_text)}
          >
            <Text style={styles.whisperActionText}>Use Suggested Reply</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Input Area */}
      <View style={styles.inputArea}>
        <TouchableOpacity style={styles.templateBtn}>
          <Feather name="plus" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]} 
          onPress={sendMessage}
          disabled={!message.trim()}
        >
          <Feather name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E5DDD5" }, // Classic WhatsApp background
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  contextCard: { backgroundColor: "#fff", padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  contextHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  contextTitle: { fontSize: 13, fontWeight: "700", color: colors.text.secondary },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniBadgeText: { fontSize: 10, fontWeight: "800", color: colors.brand.dark },
  contextSummary: { fontSize: 13, color: colors.text.primary, lineHeight: 18 },
  whisperCard: { 
    margin: 10, 
    padding: 12, 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    borderLeftWidth: 4, 
    borderLeftColor: colors.brand.green,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  whisperHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  whisperLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  whisperLabel: { fontSize: 11, fontWeight: "800", color: colors.brand.green, letterSpacing: 0.5 },
  whisperText: { fontSize: 14, color: colors.text.primary, lineHeight: 20 },
  whisperAction: { marginTop: 10, alignSelf: "flex-start" },
  whisperActionText: { color: colors.status.info, fontWeight: "700", fontSize: 13 },
  chatContent: { padding: 15 },
  messageWrapper: { marginBottom: 10, maxWidth: "80%" },
  inboundWrapper: { alignSelf: "flex-start" },
  outboundWrapper: { alignSelf: "flex-end" },
  messageBubble: { padding: 10, borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1 },
  inboundBubble: { backgroundColor: "#fff", borderTopLeftRadius: 0 },
  outboundBubble: { backgroundColor: "#DCF8C6", borderTopRightRadius: 0 },
  messageText: { fontSize: 16, color: colors.text.primary },
  outboundText: { color: colors.text.primary },
  messageTime: { fontSize: 10, color: colors.text.muted, alignSelf: "flex-end", marginTop: 4 },
  outboundTime: { color: "rgba(0,0,0,0.45)" },
  inputArea: { flexDirection: "row", padding: 10, backgroundColor: "#F0F0F0", alignItems: "center" },
  templateBtn: { padding: 8 },
  textInput: { flex: 1, backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, fontSize: 16, maxHeight: 100, marginHorizontal: 8 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#075E54", alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: colors.text.muted },
});
