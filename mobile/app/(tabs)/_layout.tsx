import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Drawer } from "expo-router/drawer";
import { DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors } from "../../src/theme/colors";

function CustomDrawerContent(props: any) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.drawerContainer}>
      <View style={[styles.drawerHeader, { paddingTop: insets.top + 12 }]}>
        <View style={styles.logoRow}>
          <View style={styles.iconCircle}>
            <Feather name="phone" size={16} color={colors.brand.yellow} />
          </View>
          <View>
            <Text style={styles.brandName}>BANGBET</Text>
            <Text style={styles.brandSub}>Telemarketing</Text>
          </View>
        </View>
      </View>

      <Text style={styles.navLabel}>NAVIGATION</Text>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <View style={[styles.drawerFooter, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.userRow}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(user?.full_name || "A")[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.full_name || "Agent"}
            </Text>
            <Text style={styles.userRole}>{user?.role}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <Feather name="log-out" size={14} color={colors.brand.dark} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const isManager = user?.role === "management" || user?.role === "admin";

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bg.card,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.default,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontWeight: "700", fontSize: 16 },
        drawerActiveTintColor: colors.brand.dark,
        drawerInactiveTintColor: "rgba(51,51,51,0.6)",
        drawerActiveBackgroundColor: "rgba(51,51,51,0.15)",
        drawerLabelStyle: { fontWeight: "600", fontSize: 14, marginLeft: 0 },
        drawerItemStyle: { borderRadius: 8, marginHorizontal: 8 },
        sceneStyle: { backgroundColor: colors.bg.dashboard },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerTitle: "BANGBET Dialer",
          headerTitleStyle: { fontWeight: "900", color: colors.brand.dark, letterSpacing: 0.5 },
          drawerLabel: "Dashboard",
          drawerIcon: ({ focused, color }) => <Feather name="home" size={18} color={color} />,
        }}
      />
      <Drawer.Screen
        name="leads"
        options={{
          title: "Leads",
          drawerLabel: "Leads",
          drawerIcon: ({ focused, color }) => <Feather name="check-square" size={18} color={color} />,
        }}
      />
      <Drawer.Screen
        name="callbacks"
        options={{
          title: "Callbacks",
          drawerLabel: "Callbacks",
          drawerIcon: ({ focused, color }) => <Feather name="phone-call" size={18} color={color} />,
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          title: "Settings",
          drawerLabel: "Settings",
          drawerIcon: ({ focused, color }) => <Feather name="settings" size={18} color={color} />,
        }}
      />
      <Drawer.Screen
        name="approve-agents"
        options={{
          title: "Approve Agents",
          drawerLabel: "Approve Agents",
          drawerIcon: ({ focused, color }) => <Feather name="user-check" size={18} color={color} />,
          drawerItemStyle: isManager ? {} : { display: "none" },
        }}
      />
      <Drawer.Screen
        name="distribute"
        options={{
          title: "Manage Leads",
          drawerLabel: "Manage Leads",
          drawerIcon: ({ focused, color }) => <Feather name="layers" size={18} color={color} />,
          drawerItemStyle: isManager ? {} : { display: "none" },
        }}
      />
      <Drawer.Screen
        name="import-leads"
        options={{
          title: "Import Leads",
          drawerLabel: "Import Leads",
          drawerIcon: ({ focused, color }) => <Feather name="upload-cloud" size={18} color={color} />,
          drawerItemStyle: isManager ? {} : { display: "none" },
        }}
      />
      <Drawer.Screen
        name="refresh-performance"
        options={{
          title: "Refresh Performance",
          drawerLabel: "Refresh Performance",
          drawerIcon: ({ focused, color }) => <Feather name="refresh-ccw" size={18} color={color} />,
          drawerItemStyle: isManager ? {} : { display: "none" },
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: colors.brand.yellow },
  drawerHeader: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(51,51,51,0.1)" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  brandName: { fontSize: 18, fontWeight: "900", color: colors.brand.dark, letterSpacing: 1.5 },
  brandSub: { fontSize: 10, color: "rgba(51,51,51,0.6)", fontWeight: "600" },
  navLabel: { fontSize: 10, fontWeight: "700", color: "rgba(51,51,51,0.4)", letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  drawerFooter: { borderTopWidth: 1, borderTopColor: "rgba(51,51,51,0.1)", padding: 16 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  userAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  userAvatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  userName: { fontSize: 14, fontWeight: "600", color: colors.brand.dark },
  userRole: { fontSize: 11, color: "rgba(51,51,51,0.5)", textTransform: "capitalize" },
  logoutBtn: { flexDirection: "row", paddingVertical: 10, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(51,51,51,0.08)", borderRadius: 8 },
  logoutText: { color: colors.brand.dark, fontWeight: "600", fontSize: 13 },
});
