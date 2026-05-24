import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type Colors } from "../theme/ThemeContext";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Payment">;

const PRICE = 90;

export function PaymentScreen({ navigation, route }: Props) {
  const { register } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPay() {
    if (paid || busy) return;
    setError(null);
    setBusy(true);
    setPaid(true);
    try {
      const admin = await register(route.params);
      Alert.alert(
        "Payment successful",
        `Thank you! Your admin id is ${admin.adminId}. Please login with your mobile number to continue.`,
        [
          {
            text: "OK",
            onPress: () => navigation.navigate("Login", { role: "admin" }),
          },
        ]
      );
    } catch (e) {
      setPaid(false);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={12}
          disabled={busy}
        >
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.appTitle}>Activation</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>One-time activation</Text>
        <Text style={styles.subheading}>
          Pay the one-time activation fee to start using the app.
        </Text>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Total amount</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceCurrency}>$</Text>
            <Text style={styles.priceValue}>{PRICE}</Text>
          </View>
          <Text style={styles.priceCaption}>Lifetime access · billed once</Text>

          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <View style={styles.tick}>
              <Text style={styles.tickText}>✓</Text>
            </View>
            <Text style={styles.featureText}>
              Manage unlimited colleges, buses and drivers
            </Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.tick}>
              <Text style={styles.tickText}>✓</Text>
            </View>
            <Text style={styles.featureText}>
              Live driver location for students on the map
            </Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.tick}>
              <Text style={styles.tickText}>✓</Text>
            </View>
            <Text style={styles.featureText}>
              Routes, stops and seat assignments
            </Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View
            style={[styles.statusDot, paid && styles.statusDotPaid]}
          />
          <Text style={styles.statusText}>
            {paid ? "Payment received" : "Payment pending"}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {busy ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
        ) : (
          <Pressable
            onPress={onPay}
            disabled={paid}
            style={({ pressed }) => [
              styles.payBtn,
              pressed && styles.payBtnPressed,
              paid && styles.payBtnPaid,
            ]}
          >
            <Text style={styles.payBtnText}>
              {paid ? "Paid" : `Pay $${PRICE}`}
            </Text>
          </Pressable>
        )}

        <Text style={styles.footnote}>
          By paying, you agree to the terms of service. This is a one-time fee
          for the lifetime of your admin account.
        </Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    appBar: {
      paddingTop: 56,
      paddingBottom: 16,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.surfaceContrast,
      alignItems: "center",
      justifyContent: "center",
    },
    iconText: { color: colors.text, fontWeight: "800", fontSize: 18 },
    appTitle: { fontSize: 18, fontWeight: "700", color: colors.text },

    body: { flex: 1 },
    bodyContent: { padding: 24, paddingBottom: 48 },

    heading: { fontSize: 28, fontWeight: "800", color: colors.text },
    subheading: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 6,
      marginBottom: 24,
    },

    priceCard: {
      backgroundColor: colors.statsBg,
      borderRadius: 24,
      padding: 24,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    priceLabel: {
      color: colors.statsLabel,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: 6,
    },
    priceCurrency: {
      color: colors.accent,
      fontSize: 28,
      fontWeight: "800",
      marginTop: 8,
      marginRight: 4,
    },
    priceValue: {
      color: "#fff",
      fontSize: 64,
      fontWeight: "900",
      lineHeight: 70,
    },
    priceCaption: {
      color: colors.statsLabel,
      fontSize: 12,
      fontWeight: "600",
      marginTop: 4,
    },

    divider: {
      height: 1,
      backgroundColor: "rgba(255,255,255,0.08)",
      marginVertical: 18,
    },

    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 10,
    },
    tick: {
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    tickText: {
      color: colors.textOnAccent,
      fontSize: 12,
      fontWeight: "800",
    },
    featureText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
      flex: 1,
    },

    statusCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
      marginTop: 18,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.textMuted,
    },
    statusDotPaid: { backgroundColor: colors.accent },
    statusText: { color: colors.text, fontSize: 13, fontWeight: "700" },

    payBtn: {
      marginTop: 24,
      backgroundColor: colors.accent,
      paddingVertical: 18,
      borderRadius: 14,
      alignItems: "center",
      shadowColor: colors.accent,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    payBtnPressed: { opacity: 0.9 },
    payBtnPaid: {
      backgroundColor: colors.surfaceContrast,
      shadowOpacity: 0,
    },
    payBtnText: {
      color: colors.textOnAccent,
      fontSize: 17,
      fontWeight: "800",
    },

    footnote: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 16,
      textAlign: "center",
      lineHeight: 16,
    },

    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: "rgba(192,57,43,0.08)",
      borderWidth: 1,
      borderColor: "rgba(192,57,43,0.2)",
    },
    errorIcon: {
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: colors.danger,
      color: "#fff",
      textAlign: "center",
      lineHeight: 22,
      fontSize: 13,
      fontWeight: "800",
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: "600",
      flex: 1,
    },
  });
}
