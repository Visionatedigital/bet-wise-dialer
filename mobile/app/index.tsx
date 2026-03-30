import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../src/contexts/AuthContext";
import { colors } from "../src/theme/colors";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/login");
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <View style={styles.iconCircle}>
          <Feather name="phone" size={22} color={colors.brand.yellow} />
        </View>
        <View>
          <Text style={styles.brand}>BANGBET</Text>
          <Text style={styles.sub}>Telemarketing</Text>
        </View>
      </View>
      <ActivityIndicator size="large" color={colors.brand.green} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.brand.yellow },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconCircle: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  // iconText removed — using Feather icon
  brand: { fontSize: 28, fontWeight: "900", color: colors.brand.dark, letterSpacing: 2 },
  sub: { fontSize: 12, color: "rgba(51,51,51,0.6)", fontWeight: "600", letterSpacing: 1 },
});
