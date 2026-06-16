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

  const isCrm = user?.role === "crm";

  return (
    <View style={[styles.drawerContainer, isCrm && styles.crmDrawerContainer]}>
      <View style={[styles.drawerHeader, { paddingTop: insets.top + 12 }, isCrm && styles.crmDrawerHeader]}>
        <View style={styles.logoRow}>
          <View style={[styles.iconCircle, isCrm && styles.crmIconCircle]}>
            <Feather name={isCrm ? "heart" : "phone"} size={16} color={isCrm ? "#000" : colors.brand.yellow} />
          </View>
          <View>
            <Text style={[styles.brandName, isCrm && styles.crmBrandName]}>BANGBET</Text>
            <Text style={[styles.brandSub, isCrm && styles.crmBrandSub]}>{isCrm ? "CRM PORTAL" : "Telemarketing"}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.navLabel, isCrm && styles.crmNavLabel]}>NAVIGATION</Text>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <View style={[styles.drawerFooter, { paddingBottom: insets.bottom + 12 }, isCrm && styles.crmDrawerFooter]}>
        <View style={styles.userRow}>
          <View style={[styles.userAvatar, isCrm && styles.crmUserAvatar]}>
            <Text style={[styles.userAvatarText, isCrm && styles.crmUserAvatarText]}>
              {(user?.full_name || "A")[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, isCrm && styles.crmUserName]} numberOfLines={1}>
              {user?.full_name || "Agent"}
            </Text>
            <Text style={[styles.userRole, isCrm && styles.crmUserRole]}>{user?.role}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.logoutBtn, isCrm && styles.crmLogoutBtn]}
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <Feather name="log-out" size={14} color={isCrm ? "#fff" : colors.brand.dark} />
          <Text style={[styles.logoutText, isCrm && styles.crmLogoutText]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  const router = useRouter();
  const isManager = user?.role === "management" || user?.role === "admin";
  const isCrm = user?.role === "crm";
  const isAgent = user?.role === "agent";

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: isCrm ? "#065f46" : colors.bg.card,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: isCrm ? 0 : 1,
          borderBottomColor: colors.border.default,
        },
        headerTintColor: isCrm ? "#ffffff" : colors.text.primary,
        headerTitleStyle: { fontWeight: "700", fontSize: 16 },
        drawerActiveTintColor: isCrm ? "#ffffff" : colors.brand.dark,
        drawerInactiveTintColor: isCrm ? "rgba(255,255,255,0.6)" : "rgba(51,51,51,0.6)",
        drawerActiveBackgroundColor: isCrm ? "rgba(255,255,255,0.15)" : "rgba(51,51,51,0.15)",
        drawerLabelStyle: { fontWeight: "600", fontSize: 14, marginLeft: 0 },
        drawerItemStyle: { borderRadius: 8, marginHorizontal: 8 },
        sceneStyle: { backgroundColor: isCrm ? "#f0fdf4" : colors.bg.dashboard },
      }}
    >
      {/* ── Dashboard (everyone) ── */}
      <Drawer.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerTitle: isCrm ? "CRM HUB" : "BANGBET Dialer",
          headerTitleStyle: { fontWeight: "900", color: isCrm ? "#ffffff" : colors.brand.dark, letterSpacing: 0.5 },
          drawerLabel: "Dashboard",
          drawerIcon: ({ color }) => <Feather name="home" size={18} color={color} />,
          drawerItemStyle: isCrm ? { display: "none" } : { borderRadius: 8, marginHorizontal: 8 },
        }}
      />
      
      {/* ... (rest of the screens remain the same) ... */}
      <Drawer.Screen
        name="leads"
        options={{
          title: "Leads",
          drawerLabel: "Leads",
          drawerIcon: ({ color }) => <Feather name="check-square" size={18} color={color} />,
          drawerItemStyle: isAgent ? { borderRadius: 8, marginHorizontal: 8 } : { display: "none" },
        }}
      />
      <Drawer.Screen
        name="callbacks"
        options={{
          title: "Callbacks",
          drawerLabel: "Callbacks",
          drawerIcon: ({ color }) => <Feather name="phone-call" size={18} color={color} />,
          drawerItemStyle: isAgent ? { borderRadius: 8, marginHorizontal: 8 } : { display: "none" },
        }}
      />

      <Drawer.Screen
        name="import-leads"
        options={{
          title: "Import Leads",
          drawerLabel: "Import Leads",
          drawerIcon: ({ color }) => <Feather name="upload-cloud" size={18} color={color} />,
          drawerItemStyle: isManager ? { borderRadius: 8, marginHorizontal: 8 } : { display: "none" },
        }}
      />
      <Drawer.Screen
        name="distribute"
        options={{
          title: "Manage Leads",
          drawerLabel: "Manage Leads",
          drawerIcon: ({ color }) => <Feather name="layers" size={18} color={color} />,
          drawerItemStyle: isManager ? { borderRadius: 8, marginHorizontal: 8 } : { display: "none" },
        }}
      />
      <Drawer.Screen
        name="refresh-performance"
        options={{
          title: "Recycle Leads",
          drawerLabel: "Recycle Leads",
          drawerIcon: ({ color }) => <Feather name="refresh-ccw" size={18} color={color} />,
          drawerItemStyle: isManager ? { borderRadius: 8, marginHorizontal: 8 } : { display: "none" },
        }}
      />
      <Drawer.Screen
        name="deposit-analytics"
        options={{
          title: "Deposit Analytics",
          drawerLabel: "Deposit Analytics",
          drawerIcon: ({ color }) => <Feather name="bar-chart-2" size={18} color={color} />,
          drawerItemStyle: isManager ? { borderRadius: 8, marginHorizontal: 8 } : { display: "none" },
        }}
      />
      <Drawer.Screen
        name="approve-agents"
        options={{
          title: "Approve Agents",
          drawerLabel: "Approve Agents",
          drawerIcon: ({ color }) => <Feather name="user-check" size={18} color={color} />,
          drawerItemStyle: isManager ? { borderRadius: 8, marginHorizontal: 8 } : { display: "none" },
        }}
      />

      <Drawer.Screen
        name="crm-dashboard"
        options={{
          title: "CRM Dashboard",
          headerTitle: "CRM HUB",
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => router.push('/notifications')}
              style={{ marginRight: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}
            >
              <Feather name="bell" size={20} color="#fff" />
              <View style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFE600', borderWidth: 1.5, borderColor: '#064e3b' }} />
            </TouchableOpacity>
          ),
          drawerLabel: "CRM Dashboard",
          drawerIcon: ({ color }) => <Feather name="heart" size={18} color={color} />,
          drawerItemStyle: isCrm ? { borderRadius: 8, marginHorizontal: 8 } : { display: "none" },
        }}
      />
      <Drawer.Screen
        name="contacts"
        options={{
          title: "Contacts",
          drawerLabel: "Contacts",
          drawerIcon: ({ color }) => <Feather name="users" size={18} color={color} />,
          drawerItemStyle: isCrm ? { borderRadius: 8, marginHorizontal: 8 } : { display: "none" },
        }}
      />
      <Drawer.Screen
        name="crm-import"
        options={{
          title: "Import Clients",
          drawerLabel: "Import Clients",
          drawerIcon: ({ color }) => <Feather name="user-plus" size={18} color={color} />,
          drawerItemStyle: isCrm ? { borderRadius: 8, marginHorizontal: 8 } : { display: "none" },
        }}
      />

      <Drawer.Screen
        name="settings"
        options={{
          title: "Settings",
          drawerLabel: "Settings",
          drawerIcon: ({ color }) => <Feather name="settings" size={18} color={color} />,
        }}
      />

      <Drawer.Screen
        name="help"
        options={{
          title: "Help",
          drawerLabel: "Help",
          drawerIcon: ({ color }) => <Feather name="help-circle" size={18} color={color} />,
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: colors.brand.yellow },
  crmDrawerContainer: { backgroundColor: "#064e3b" }, // Dark Emerald
  drawerHeader: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(51,51,51,0.1)" },
  crmDrawerHeader: { borderBottomColor: "rgba(255,255,255,0.1)" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  crmIconCircle: { backgroundColor: "#FFE600" },
  brandName: { fontSize: 18, fontWeight: "900", color: colors.brand.dark, letterSpacing: 1.5 },
  crmBrandName: { color: "#ffffff" },
  brandSub: { fontSize: 10, color: "rgba(51,51,51,0.6)", fontWeight: "600" },
  crmBrandSub: { color: "rgba(255,255,255,0.6)" },
  navLabel: { fontSize: 10, fontWeight: "700", color: "rgba(51,51,51,0.4)", letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  crmNavLabel: { color: "rgba(255,255,255,0.4)" },
  drawerFooter: { borderTopWidth: 1, borderTopColor: "rgba(51,51,51,0.1)", padding: 16 },
  crmDrawerFooter: { borderTopColor: "rgba(255,255,255,0.1)" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  userAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand.green, alignItems: "center", justifyContent: "center" },
  crmUserAvatar: { backgroundColor: "#FFE600" },
  userAvatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  crmUserAvatarText: { color: "#000" },
  userName: { fontSize: 14, fontWeight: "600", color: colors.brand.dark },
  crmUserName: { color: "#ffffff" },
  userRole: { fontSize: 11, color: "rgba(51,51,51,0.5)", textTransform: "capitalize" },
  crmUserRole: { color: "rgba(255,255,255,0.5)" },
  logoutBtn: { flexDirection: "row", paddingVertical: 10, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(51,51,51,0.08)", borderRadius: 8 },
  crmLogoutBtn: { backgroundColor: "rgba(255,255,255,0.1)" },
  logoutText: { color: colors.brand.dark, fontWeight: "600", fontSize: 13 },
  crmLogoutText: { color: "#ffffff" },
});
