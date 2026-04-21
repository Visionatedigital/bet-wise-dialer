import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/contexts/AuthContext";

const COUNTRIES = [
  { code: 'UG', name: 'Uganda',   flag: '🇺🇬', dialCode: '256' },
  { code: 'GH', name: 'Ghana',    flag: '🇬🇭', dialCode: '233' },
  { code: 'NG', name: 'Nigeria',  flag: '🇳🇬', dialCode: '234' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', dialCode: '255' },
  { code: 'KE', name: 'Kenya',    flag: '🇰🇪', dialCode: '254' },
];

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry] = useState("UG");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  const selectedCountry = COUNTRIES.find(c => c.code === country) || COUNTRIES[0];

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const message = await signup(email.trim().toLowerCase(), password, fullName.trim(), country);
      Alert.alert("Account Created", message || "Your account is pending approval. An administrator will review your access.", [
        { text: "OK", onPress: () => router.replace("/login") },
      ]);
    } catch (err: any) {
      Alert.alert("Sign Up Failed", err.message || "Could not create account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.background, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to start making calls</Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#999"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <Text style={styles.label}>Country</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowCountryPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.pickerText}>
                {selectedCountry.flag}  {selectedCountry.name} (+{selectedCountry.dialCode})
              </Text>
              <Text style={styles.pickerChevron}>▾</Text>
            </TouchableOpacity>

            <Modal
              visible={showCountryPicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowCountryPicker(false)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowCountryPicker(false)}
              >
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Select Country</Text>
                  <FlatList
                    data={COUNTRIES}
                    keyExtractor={item => item.code}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.countryItem, item.code === country && styles.countryItemSelected]}
                        onPress={() => { setCountry(item.code); setShowCountryPicker(false); }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.countryFlag}>{item.flag}</Text>
                        <Text style={styles.countryName}>{item.name}</Text>
                        <Text style={styles.countryDial}>+{item.dialCode}</Text>
                        {item.code === country && <Text style={styles.countryCheck}>✓</Text>}
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </TouchableOpacity>
            </Modal>

            <TouchableOpacity
              style={[styles.button, submitting && { opacity: 0.6 }]}
              onPress={handleSignup}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace("/login")} style={styles.linkRow}>
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#FFE600" },
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 28,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1a1a1a", textAlign: "center" },
  subtitle: { fontSize: 13, color: "#666", textAlign: "center", marginBottom: 20, marginTop: 4 },
  label: { fontSize: 13, fontWeight: "500", color: "#333", marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1a1a1a",
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  linkRow: { marginTop: 16, alignItems: "center" },
  linkText: { fontSize: 13, color: "#666" },
  linkBold: { fontWeight: "700", color: "#22c55e" },
  pickerButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontSize: 15, color: "#1a1a1a" },
  pickerChevron: { fontSize: 16, color: "#999" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxHeight: 360,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  countryItemSelected: { backgroundColor: "#f0fdf4" },
  countryFlag: { fontSize: 22, marginRight: 10 },
  countryName: { flex: 1, fontSize: 15, color: "#1a1a1a" },
  countryDial: { fontSize: 13, color: "#888", marginRight: 8 },
  countryCheck: { fontSize: 16, color: "#22c55e", fontWeight: "700" },
});
