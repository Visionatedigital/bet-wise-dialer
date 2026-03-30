import React, { useEffect } from "react";
import { Platform, Alert } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/contexts/AuthContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Updates from "expo-updates";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10000 } },
});

function useOTAUpdates() {
  useEffect(() => {
    if (__DEV__) return;
    async function checkForUpdate() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert(
            "Update Available",
            "A new version of Bangbet Dialer is available. Update now?",
            [
              { text: "Later", style: "cancel" },
              {
                text: "Update",
                onPress: async () => {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                },
              },
            ]
          );
        }
      } catch {}
    }
    checkForUpdate();
  }, []);
}

export default function RootLayout() {
  useOTAUpdates();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" translucent={false} backgroundColor="#ffffff" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#f8fafc" },
                animation: "slide_from_right",
                statusBarTranslucent: false,
                statusBarColor: "#ffffff",
                statusBarStyle: "dark",
              }}
            />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
