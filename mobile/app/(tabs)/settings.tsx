import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, TextInput, ActivityIndicator, Image, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { api } from "../../src/api/client";
import { colors } from "../../src/theme/colors";

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url || null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const requestPermission = async (type: "camera" | "library") => {
    if (type === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === "granted";
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === "granted";
    }
  };

  const processAndUpload = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      // Build a base64 data URI — no separate file server needed
      const base64 = asset.base64;
      if (!base64) throw new Error("Could not read image data");
      const mimeType = asset.mimeType ?? "image/jpeg";
      const dataUri = `data:${mimeType};base64,${base64}`;

      // Optimistic update
      setAvatarUri(dataUri);

      await api.patch(`/profiles/${user!.id}`, { avatar_url: dataUri });
      await refreshUser();
      Alert.alert("✓ Photo updated", "Your profile photo has been saved.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to upload photo");
      // Revert on failure
      setAvatarUri(user?.avatar_url || null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickImage = () => {
    Alert.alert(
      "Change Profile Photo",
      "Choose a source",
      [
        {
          text: "Take Photo",
          onPress: async () => {
            const granted = await requestPermission("camera");
            if (!granted) {
              Alert.alert("Permission required", "Camera access is needed to take a photo.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
              base64: true,
            });
            await processAndUpload(result);
          },
        },
        {
          text: "Choose from Library",
          onPress: async () => {
            const granted = await requestPermission("library");
            if (!granted) {
              Alert.alert("Permission required", "Photo library access is needed.");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
              base64: true,
            });
            await processAndUpload(result);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    setSavingProfile(true);
    try {
      await api.patch(`/profiles/${user!.id}`, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
      });
      Alert.alert("Saved", "Profile updated successfully");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all password fields");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Done", "Password changed successfully");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (user?.full_name || user?.email || "?")[0].toUpperCase();

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          onPress={pickImage}
          onLongPress={avatarUri ? () => {
            Alert.alert("Remove Photo", "Remove your profile photo?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove", style: "destructive",
                onPress: async () => {
                  setUploadingAvatar(true);
                  try {
                    await api.patch(`/profiles/${user!.id}`, { avatar_url: null });
                    setAvatarUri(null);
                    await refreshUser();
                  } catch (err: any) {
                    Alert.alert("Error", err.message || "Failed to remove photo");
                  } finally {
                    setUploadingAvatar(false);
                  }
                },
              },
            ]);
          } : undefined}
          activeOpacity={0.8}
          disabled={uploadingAvatar}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
          {/* Camera badge */}
          <View style={styles.cameraBtn}>
            {uploadingAvatar ? (
              <ActivityIndicator size={12} color={colors.brand.green} />
            ) : (
              <Feather name="camera" size={14} color={colors.text.primary} />
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>
          {uploadingAvatar ? "Uploading…" : "Tap to change · Hold to remove"}
        </Text>
      </View>

      {/* Profile Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>

        <Text style={styles.fieldLabel}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />

        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.roleRow}>
          <Text style={styles.roleLabel}>Role</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, savingProfile && { opacity: 0.6 }]}
          onPress={handleSaveProfile}
          disabled={savingProfile}
          activeOpacity={0.8}
        >
          {savingProfile ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save Profile</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Change Password */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change Password</Text>

        <Text style={styles.fieldLabel}>Current Password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Current password"
          placeholderTextColor="#999"
          secureTextEntry
        />

        <Text style={styles.fieldLabel}>New Password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New password (min 6 chars)"
          placeholderTextColor="#999"
          secureTextEntry
        />

        <Text style={styles.fieldLabel}>Confirm New Password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          placeholderTextColor="#999"
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.saveBtn, savingPassword && { opacity: 0.6 }]}
          onPress={handleChangePassword}
          disabled={savingPassword}
          activeOpacity={0.8}
        >
          {savingPassword ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Change Password</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.infoSection}>
        <InfoRow label="App Version" value="1.0.0" />
        <InfoRow label="Platform" value="Mobile" />
        <InfoRow label="Status" value="Online" valueColor={colors.status.success} last />
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() =>
          Alert.alert("Logout", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Logout",
              style: "destructive",
              onPress: async () => { await logout(); router.replace("/login"); },
            },
          ])
        }
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function InfoRow({ label, value, valueColor, last }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <View style={[infoStyles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border.default },
  label: { fontSize: 14, color: colors.text.secondary },
  value: { fontSize: 14, color: colors.text.primary, fontWeight: "500" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  avatarSection: { alignItems: "center", paddingTop: 28, paddingBottom: 8 },
  avatarImg: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: colors.brand.green },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontSize: 34, fontWeight: "700" },
  cameraBtn: { position: "absolute", bottom: 0, right: 0, backgroundColor: "#fff", borderRadius: 14, width: 28, height: 28, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, elevation: 3, borderWidth: 1, borderColor: colors.border.default },
  avatarHint: { fontSize: 12, color: colors.text.secondary, marginTop: 8 },
  card: { backgroundColor: colors.bg.card, marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: colors.border.default },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text.primary, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.text.secondary, marginBottom: 5, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: "#1a1a1a", marginBottom: 12 },
  roleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  roleLabel: { fontSize: 12, fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: 0.4 },
  roleBadge: { backgroundColor: colors.bg.accent, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  roleText: { color: colors.brand.green, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  saveBtn: { backgroundColor: colors.brand.green, borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  infoSection: { backgroundColor: colors.bg.card, marginHorizontal: 16, marginTop: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border.default },
  logoutBtn: { marginHorizontal: 16, marginTop: 20, borderRadius: 8, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.status.error },
  logoutText: { color: colors.status.error, fontSize: 15, fontWeight: "600" },
});
