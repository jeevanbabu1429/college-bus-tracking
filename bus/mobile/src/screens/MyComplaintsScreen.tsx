import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme, type Colors } from "../theme/ThemeContext";
import {
  categoryLabel,
  complaintScreenshotSource,
  complaintsApi,
  STATUS_LABELS,
  type Complaint,
  type ComplaintStatus,
} from "../api/complaints";
import type { SupportRoutes } from "../navigation/types";

export function MyComplaintsScreen() {
  // Shared across all three stacks — see ReportProblemScreen for why.
  const navigation = useNavigation<NativeStackNavigationProp<SupportRoutes>>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refetch on focus rather than on mount: coming back from Report a problem
  // should show the complaint that was just sent, and a reply may have landed
  // while the app was in the background.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      complaintsApi
        .mine()
        .then((list) => {
          if (!cancelled) setComplaints(list);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <View style={styles.root}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Text style={styles.iconBtnText}>←</Text>
        </Pressable>
        <Text style={styles.appBarTitle}>Help &amp; support</Text>
      </View>

      <Pressable
        onPress={() => navigation.navigate("ReportProblem")}
        style={styles.newBtn}
      >
        <Text style={styles.newBtnText}>Report a problem</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {complaints === null && !error ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : (
        <FlatList
          data={complaints ?? []}
          keyExtractor={(c) => c._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            error ? null : (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>Nothing reported yet</Text>
                <Text style={styles.emptyBody}>
                  If something in the app is not working, tell us about it and we
                  will get back to you here.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => <ComplaintCard complaint={item} styles={styles} />}
        />
      )}
    </View>
  );
}

function ComplaintCard({
  complaint,
  styles,
}: {
  complaint: Complaint;
  styles: ReturnType<typeof makeStyles>;
}) {
  const shot = complaint.hasScreenshot
    ? complaintScreenshotSource(complaint._id)
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardCategory}>{categoryLabel(complaint.category)}</Text>
        <StatusPill status={complaint.status} styles={styles} />
      </View>

      <Text style={styles.cardMessage}>{complaint.message}</Text>

      {shot && (
        <Image source={shot} style={styles.cardShot} resizeMode="contain" />
      )}

      <Text style={styles.cardDate}>{formatDate(complaint.createdAt)}</Text>

      {complaint.replies.length > 0 && (
        <View style={styles.replies}>
          {complaint.replies.map((r, i) => (
            <View key={`${r.at}-${i}`} style={styles.reply}>
              <Text style={styles.replyFrom}>Support</Text>
              <Text style={styles.replyBody}>{r.body}</Text>
              <Text style={styles.replyDate}>{formatDate(r.at)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StatusPill({
  status,
  styles,
}: {
  status: ComplaintStatus;
  styles: ReturnType<typeof makeStyles>;
}) {
  const tone =
    status === "resolved"
      ? styles.pillResolved
      : status === "in_progress"
        ? styles.pillProgress
        : styles.pillOpen;
  return (
    <View style={[styles.pill, tone]}>
      <Text style={styles.pillText}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
    iconBtnText: { fontSize: 20, color: colors.text },
    appBarTitle: { fontSize: 18, fontWeight: "800", color: colors.text },

    newBtn: {
      margin: 16,
      marginBottom: 4,
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    newBtnText: { fontSize: 15, fontWeight: "800", color: colors.textOnAccent },

    loading: { marginTop: 40 },
    error: {
      margin: 16,
      fontSize: 13,
      fontWeight: "600",
      color: colors.danger,
    },

    list: { padding: 16, gap: 12 },

    empty: { alignItems: "center", paddingTop: 48, paddingHorizontal: 24 },
    emptyIcon: { fontSize: 36, marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
    emptyBody: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted,
      textAlign: "center",
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 8,
    },
    cardCategory: {
      flex: 1,
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
    },
    cardMessage: { fontSize: 14, lineHeight: 20, color: colors.text },
    cardShot: {
      marginTop: 12,
      width: "100%",
      height: 180,
      borderRadius: 10,
      backgroundColor: colors.surfaceContrast,
    },
    cardDate: { marginTop: 10, fontSize: 11, color: colors.textMuted },

    pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
    pillText: { fontSize: 11, fontWeight: "800", color: "#111111" },
    pillOpen: { backgroundColor: "#ffd9a0" },
    pillProgress: { backgroundColor: "#a9d4ff" },
    pillResolved: { backgroundColor: "#a8e6b8" },

    replies: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    reply: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      padding: 12,
    },
    replyFrom: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.accent,
      marginBottom: 4,
    },
    replyBody: { fontSize: 14, lineHeight: 20, color: colors.text },
    replyDate: { marginTop: 6, fontSize: 11, color: colors.textMuted },
  });
}
