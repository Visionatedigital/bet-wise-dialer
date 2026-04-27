import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  KeyboardAvoidingView, Platform, Animated, Modal, ActivityIndicator,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../api/client';
import { colors } from '../theme/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant';
type Message = { id: string; role: Role; content: string; timestamp: Date };

interface FloatingAssistantProps {
  managerName?: string;
}

// ─── Proactive suggestion state ───────────────────────────────────────────────

const GREETING_DELAY_MS = 2500;         // show first bubble 2.5s after mount
const IDLE_SUGGESTION_MS = 5 * 60_000; // re-suggest after 5 mins of no chat

// ─── Component ────────────────────────────────────────────────────────────────

export function FloatingAssistant({ managerName }: FloatingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ icon: string; text: string } | null>(null);
  const [suggestionVisible, setSuggestionVisible] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);

  const listRef = useRef<FlatList<Message>>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const suggestionAnim = useRef(new Animated.Value(0)).current;
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Pulse animation on the bubble ──────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Fetch and show proactive suggestion ────────────────────────────────────
  const fetchAndShowSuggestion = useCallback(async () => {
    if (isOpen) return;
    try {
      const data = await api.get<{ icon: string; text: string }>('/ai/suggestion');
      setSuggestion(data);
      setSuggestionVisible(true);
      Animated.spring(suggestionAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }).start();
      setTimeout(() => hideSuggestion(), 8000); // auto-hide after 8s
    } catch { /* silent */ }
  }, [isOpen]);

  const hideSuggestion = () => {
    Animated.timing(suggestionAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setSuggestionVisible(false);
    });
  };

  // Show on mount and reset idle timer on activity
  useEffect(() => {
    const t = setTimeout(fetchAndShowSuggestion, GREETING_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(fetchAndShowSuggestion, IDLE_SUGGESTION_MS);
  }, [fetchAndShowSuggestion]);

  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [messages]);

  // ── Open / Close ────────────────────────────────────────────────────────────
  const openChat = () => {
    hideSuggestion();
    setIsOpen(true);
    if (messages.length === 0) {
      const greeting = `Hi ${managerName?.split(' ')[0] || 'there'}! I'm BetBot, your team assistant.\n\nI can help you:\n• Summarize today's team performance\n• Find your top performing agents\n• Check unassigned leads\n• Clear stale lead categories\n• Review recent call notes\n\nWhat would you like to know?`;
      setMessages([{ id: '0', role: 'assistant', content: greeting, timestamp: new Date() }]);
    }
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');
    setPendingConfirm(null);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);
    resetIdleTimer();

    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const apiMessages = updatedMessages
        .filter(m => m.id !== '0') // skip the local greeting
        .map(m => ({ role: m.role, content: m.content }));

      const { reply } = await api.post<{ reply: string }>('/ai/assistant', { messages: apiMessages });

      const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);

      // Detect if bot is asking for confirmation
      if (reply.toLowerCase().includes('confirm') || reply.toLowerCase().includes('are you sure')) {
        setPendingConfirm(content);
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: `⚠️ Sorry, I ran into an issue: ${err.message}`, timestamp: new Date() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const confirmAction = () => {
    if (pendingConfirm) sendMessage(`Yes, confirmed. Proceed with: ${pendingConfirm}`);
  };

  // ── Quick action chips ──────────────────────────────────────────────────────
  const quickActions = [
    { label: '📊 Team summary', msg: "Give me a summary of today's team performance" },
    { label: '🏆 Top agents', msg: "Who are the top 3 performing agents this week?" },
    { label: '📋 Lead counts', msg: "How many leads do we have in each category?" },
    { label: '📝 Call notes', msg: "Summarize the last 24 hours of call notes" },
    { label: '🗑️ Clear dormant', msg: "Clear all dormant leads" },
    { label: '📦 Unassigned', msg: "How many leads are unassigned?" },
  ];

  // ── Render message ──────────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: Message }) => {
    const isBot = item.role === 'assistant';
    return (
      <View style={[styles.msgRow, isBot ? styles.msgRowBot : styles.msgRowUser]}>
        {isBot && (
          <View style={styles.botAvatar}>
            <Feather name="cpu" size={14} color={colors.brand.green} />
          </View>
        )}
        <View style={[styles.bubble, isBot ? styles.bubbleBot : styles.bubbleUser]}>
          <Text style={[styles.bubbleText, isBot ? styles.bubbleTextBot : styles.bubbleTextUser]}>
            {item.content}
          </Text>
          <Text style={styles.msgTime}>
            {item.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Proactive suggestion bubble */}
      {suggestionVisible && suggestion && !isOpen && (
        <Animated.View
          style={[
            styles.suggestionBubble,
            { opacity: suggestionAnim, transform: [{ scale: suggestionAnim }, { translateY: suggestionAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
          ]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => { hideSuggestion(); openChat(); }}
            activeOpacity={0.9}
          >
            <Text style={styles.suggestionText}>{suggestion.icon}  {suggestion.text}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={hideSuggestion} style={styles.suggestionClose}>
            <Feather name="x" size={12} color="#64748b" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Floating bubble button */}
      {!isOpen && (
        <Animated.View style={[styles.fabWrap, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity style={styles.fab} onPress={openChat} activeOpacity={0.85}>
            <Feather name="message-square" size={24} color="#fff" />
            <View style={styles.fabDot} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Chat Modal */}
      <Modal visible={isOpen} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.sheet}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerAvatar}>
                  <Feather name="cpu" size={18} color={colors.brand.green} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>BetBot</Text>
                  <Text style={styles.headerSub}>Your AI Team Assistant</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Scrollable message area — flex:1 so input is always visible */}
            <View style={styles.messagesWrap}>
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(m) => m.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                keyboardShouldPersistTaps="handled"
              />

              {/* Typing indicator */}
              {loading && (
                <View style={[styles.msgRow, styles.msgRowBot, { paddingHorizontal: 16, paddingBottom: 8 }]}>
                  <View style={styles.botAvatar}>
                    <Feather name="cpu" size={14} color={colors.brand.green} />
                  </View>
                  <View style={[styles.bubble, styles.bubbleBot, { paddingVertical: 10, paddingHorizontal: 16 }]}>
                    <ActivityIndicator size="small" color={colors.brand.green} />
                  </View>
                </View>
              )}
            </View>

            {/* Confirm action strip */}
            {pendingConfirm && !loading && (
              <View style={styles.confirmStrip}>
                <Text style={styles.confirmText}>Confirm this action?</Text>
                <TouchableOpacity onPress={confirmAction} style={styles.confirmYes}>
                  <Text style={styles.confirmYesText}>Yes, do it</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPendingConfirm(null)} style={styles.confirmNo}>
                  <Text style={styles.confirmNoText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Quick action chips — only show on empty chat */}
            {messages.length <= 1 && !loading && (
              <View style={styles.chipsWrap}>
                <FlatList
                  data={quickActions}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(a) => a.label}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.chip} onPress={() => sendMessage(item.msg)}>
                      <Text style={styles.chipText}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* ── Input bar — always visible at bottom ── */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder="Ask BetBot anything…"
                placeholderTextColor="#94a3b8"
                multiline
                maxLength={500}
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={() => sendMessage()}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
                onPress={() => sendMessage()}
                disabled={!input.trim() || loading}
              >
                <Feather name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Floating button
  fabWrap: {
    position: 'absolute', bottom: 90, right: 20, zIndex: 999,
  },
  fab: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.brand.green, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  fabDot: {
    position: 'absolute', top: 6, right: 6, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff',
  },

  // Proactive suggestion — sits to LEFT of the FAB
  suggestionBubble: {
    position: 'absolute', bottom: 94, right: 76, left: 12, zIndex: 998,
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    borderWidth: 1, borderColor: colors.border.default,
  },
  suggestionText: { flex: 1, fontSize: 13, color: colors.text.primary, lineHeight: 19, fontWeight: '500', flexWrap: 'wrap' },
  suggestionClose: { padding: 2, marginTop: 1 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%', minHeight: '65%', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
    flex: 0, flexDirection: 'column',
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
    backgroundColor: '#f8fafc',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#ecfdf5',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.brand.green,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  headerSub: { fontSize: 11, color: colors.text.muted, marginTop: 1 },
  closeBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },

  // Messages
  messagesWrap: { flex: 1, minHeight: 120 },
  messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowBot: { alignSelf: 'flex-start', maxWidth: '88%' },
  msgRowUser: { alignSelf: 'flex-end', maxWidth: '80%', flexDirection: 'row-reverse' },
  botAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#ecfdf5',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    borderWidth: 1, borderColor: colors.border.default,
  },
  botAvatarText: { fontSize: 14 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '100%' },
  bubbleBot: { backgroundColor: '#f1f5f9', borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.brand.green, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextBot: { color: colors.text.primary },
  bubbleTextUser: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'right' },

  // Quick chips
  chipsWrap: { paddingVertical: 10 },

  chip: {
    backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border.default,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text.primary },

  // Confirm strip
  confirmStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fef9c3', borderTopWidth: 1, borderTopColor: '#fde047',
  },
  confirmText: { flex: 1, fontSize: 13, color: '#854d0e', fontWeight: '500' },
  confirmYes: { backgroundColor: '#ef4444', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  confirmYesText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  confirmNo: { paddingHorizontal: 8, paddingVertical: 6 },
  confirmNoText: { color: '#64748b', fontSize: 12 },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border.default, backgroundColor: '#fff',
  },
  textInput: {
    flex: 1, backgroundColor: '#f1f5f9', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    color: colors.text.primary, maxHeight: 100,
    borderWidth: 1, borderColor: colors.border.default,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand.green,
    alignItems: 'center', justifyContent: 'center',
  },
});
