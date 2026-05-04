import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { api } from "../../src/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../src/contexts/AuthContext";
import { colors } from "../../src/theme/colors";
import { formatPhoneForCountry } from "../../src/config/countries";
import { Redirect } from "expo-router";

// Column mapping from platform export
const COLUMNS: Record<string, string> = {
  'username': 'phone',
  '手机号': 'phone',
  'phone': 'phone',
  'phonenumber': 'phone',
  'number': 'phone',
  'contact': 'phone',
  '最后登录时间': 'last_login',
  'last login': 'last_login',
  'login': 'last_login',
  '分类': 'category',
  'category': 'category',
  'trait': 'category',
  '总票数': 'total_bets',
  'bets': 'total_bets',
  'tickets': 'total_bets',
  '充值金额(美金)': 'deposit_usd',
  'deposit usd': 'deposit_usd',
  'usd': 'deposit_usd',
  '充值金额(本币)': 'deposit_local',
  'deposit': 'deposit_local',
  'amount': 'deposit_local',
  'deposit local': 'deposit_local',
  'name': 'name',
  'fullname': 'name',
  'client': 'name',
};

function parseNum(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(/[^0-9.-]/g, "")) || 0;
}

function excelDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  if (typeof v === "number") return new Date(Math.floor(v - 25569) * 86400000);
  return null;
}

function classify(depUSD: number, depLocal: number, totalBets: number, lastLogin: Date | null) {
  if (depUSD >= 1000 || depLocal >= 3_500_000)
    return { segment: "vip", tier: "High Staker", score: 95 };
  if (depUSD >= 200 || depLocal >= 700_000)
    return { segment: "semi-active", tier: "Medium Staker", score: 70 };
  if (totalBets >= 500) 
    return { segment: "semi-active", tier: "Frequent Bettor", score: 50 };
  if (lastLogin) {
    const days = Math.floor((Date.now() - lastLogin.getTime()) / 86400000);
    if (days > 60) return { segment: "dormant", tier: "Dormant", score: 15 };
  }
  return { segment: depUSD > 50 ? "semi-active" : "dormant", tier: "Low Staker", score: 30 };
}

export default function CrmImportScreen() {
  const { user, loading } = useAuth();
  const country = (user as any)?.country || "UG";
  const queryClient = useQueryClient();

  if (loading) return null;
  if (!user || user.role !== 'crm') {
    return <Redirect href="/" />;
  }

  const [fileName, setFileName] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["*/*"] });
      if (res.canceled) return;
      const file = res.assets[0];
      
      const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const wb = XLSX.read(b64, { type: "base64" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      
      // 1. Try to parse with headers (standard)
      const json: any[] = XLSX.utils.sheet_to_json(sheet);
      
      let built = json.map((row) => {
        const mapped: any = {};
        for (const [k, v] of Object.entries(row)) {
          const key = String(k).toLowerCase().trim();
          const mappedKey = COLUMNS[key] || key;
          mapped[mappedKey] = v;
        }
        
        let rawPhone = String(mapped.phone || mapped.username || mapped.mobile || "").trim();
        if (!rawPhone) {
          for (const [k, v] of Object.entries(row)) {
            const lowKey = k.toLowerCase();
            if (lowKey.includes("phone") || lowKey.includes("mobile") || lowKey.includes("number") || lowKey.includes("contact")) {
              rawPhone = String(v).trim();
              if (rawPhone) break;
            }
          }
        }

        if (!rawPhone) return null;
        
        const phone = formatPhoneForCountry(rawPhone, country);
        const { segment, tier, score } = classify(parseNum(mapped.deposit_usd), parseNum(mapped.deposit_local), parseNum(mapped.total_bets), excelDate(mapped.last_login));

        return {
          phone,
          name: mapped.name || mapped.client || mapped.fullname || `Client ${phone.slice(-4)}`,
          segment, score, lead_score: score, trait: tier,
          user_id: user?.id, 
          last_deposit_ugx: parseNum(mapped.deposit_local) || Math.round(parseNum(mapped.deposit_usd) * 3700),
        };
      }).filter(Boolean);

      // 2. FALLBACK: Headerless list
      if (built.length === 0) {
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        built = rawRows.map(row => {
          if (!row || row.length === 0) return null;
          let rawPhone = "";
          for (let i = 0; i < Math.min(row.length, 3); i++) {
            const val = String(row[i] || "").trim();
            if (val.length >= 8 && /^[0-9+]+$/.test(val.replace(/[\s-]/g, ""))) {
              rawPhone = val;
              break;
            }
          }
          if (!rawPhone) return null;
          const phone = formatPhoneForCountry(rawPhone, country);
          return {
            phone, name: `Client ${phone.slice(-4)}`,
            segment: "semi-active", score: 30, lead_score: 30, trait: "Low Staker",
            user_id: user?.id, last_deposit_ugx: 0,
          };
        }).filter(Boolean);
      }

      setFileName(file.name);
      setLeads(built);
      
      if (built.length > 0) {
        Alert.alert("Success", `Found ${built.length} clients in your file.`);
      } else {
        const headers = json.length > 0 ? Object.keys(json[0]).join(", ") : "Empty File";
        Alert.alert("No Clients Found", `Could not find any phone numbers.\n\nHeaders Found: ${headers}`);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to parse file. Make sure it is a valid Excel or CSV.");
    }
  };

  const runImport = async () => {
    if (leads.length === 0) return;
    setImporting(true);
    try {
      // Import in batches
      const BATCH_SIZE = 100;
      let totalInserted = 0;
      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        const resp = await api.post<any>("/leads/import-csv", { leads: batch, source_filename: fileName });
        totalInserted += resp.inserted || 0;
      }
      setResult({ inserted: totalInserted });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      Alert.alert("Import Complete", `Successfully imported ${leads.length} clients to your profile.`);
    } catch (err: any) {
      Alert.alert("Import Failed", err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>CRM Client Import</Text>
      <Text style={styles.subtitle}>Upload your list of clients. They will be automatically assigned to your profile for relationship management.</Text>

      <TouchableOpacity style={styles.dropzone} onPress={pickFile} disabled={importing}>
        <Feather name="file-text" size={32} color={colors.brand.green} />
        <Text style={styles.dropzoneText}>{fileName || "Select CSV or Excel File"}</Text>
        {leads.length > 0 && <Text style={styles.dropzoneSub}>{leads.length} clients ready</Text>}
      </TouchableOpacity>

      {leads.length > 0 && !result && (
        <TouchableOpacity style={styles.importBtn} onPress={runImport} disabled={importing}>
          {importing ? <ActivityIndicator color="#fff" /> : <Text style={styles.importBtnText}>Import {leads.length} Clients</Text>}
        </TouchableOpacity>
      )}

      {result && (
        <View style={styles.successBox}>
          <Feather name="check-circle" size={40} color={colors.status.success} />
          <Text style={styles.successTitle}>Import Successful</Text>
          <Text style={styles.successSub}>Your clients are now available on your CRM Dashboard.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.dashboard },
  title: { fontSize: 24, fontWeight: "800", color: colors.text.primary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: colors.text.secondary, marginBottom: 24, lineHeight: 20 },
  dropzone: { backgroundColor: colors.bg.card, borderStyle: "dashed", borderWidth: 2, borderColor: colors.brand.green, borderRadius: 12, padding: 40, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  dropzoneText: { fontSize: 16, fontWeight: "600", color: colors.text.primary, marginTop: 12 },
  dropzoneSub: { fontSize: 12, color: colors.brand.green, fontWeight: "700", marginTop: 4 },
  importBtn: { backgroundColor: colors.brand.dark, padding: 16, borderRadius: 10, alignItems: "center" },
  importBtnText: { color: colors.brand.yellow, fontSize: 16, fontWeight: "700" },
  successBox: { alignItems: "center", marginTop: 20, padding: 20, backgroundColor: "#f0fdf4", borderRadius: 12 },
  successTitle: { fontSize: 18, fontWeight: "700", color: "#166534", marginTop: 12 },
  successSub: { fontSize: 14, color: "#166534", textAlign: "center", marginTop: 4 },
});
