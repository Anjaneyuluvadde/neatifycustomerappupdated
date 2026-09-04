import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Header from "../components/Header";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";

type TabType = "current" | "completed";

export default function MyBookingsScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("current");
  const bottomNavPadding = useBottomNavPadding();

  const pagerRef = useRef<FlatList>(null);
  const width = Dimensions.get("window").width;

  const handleTabPress = (tab: TabType, index: number) => {
    setActiveTab(tab);
    pagerRef.current?.scrollToIndex({ index, animated: true });
  };

  const fetchMyBookings = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBookings(data);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMyBookings();
    }, [fetchMyBookings])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyBookings();
    setRefreshing(false);
  };

  /* ================= FILTERS ================= */

  const currentBookings = useMemo(
    () => bookings.filter((b) => {
      const normalizedWorkStatus = String(b.work_status || "").trim().toUpperCase();
      return normalizedWorkStatus !== "COMPLETED";
    }),
    [bookings],
  );

  const completedBookings = useMemo(
    () => bookings.filter((b) => {
      const normalizedWorkStatus = String(b.work_status || "").trim().toUpperCase();
      return normalizedWorkStatus === "COMPLETED";
    }),
    [bookings],
  );

  const visibleBookings =
    activeTab === "current" ? currentBookings : completedBookings;

  /* ================= LOADING ================= */



  /* ================= UI ================= */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>

      {/* ── APP HEADER (logo + icons) ── */}
      <Header isCurved={true} />

      {/* ── FIXED TITLE + TABS ── */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>{t("bookings.title")}</Text>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === "current" && { borderBottomColor: theme.text }]}
            onPress={() => handleTabPress("current", 0)}
          >
            <Text style={[styles.tabText, { color: activeTab === "current" ? theme.text : theme.textLight }]}>
              {t("bookings.current")} ({currentBookings.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === "completed" && { borderBottomColor: theme.text }]}
            onPress={() => handleTabPress("completed", 1)}
          >
            <Text style={[styles.tabText, { color: activeTab === "completed" ? theme.text : theme.textLight }]}>
              {t("bookings.completed")} ({completedBookings.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── SLIDEABLE LISTS ── */}
      <FlatList
        ref={pagerRef}
        data={[
          { key: "current", data: currentBookings, emptyKey: "bookings.noCurrent" },
          { key: "completed", data: completedBookings, emptyKey: "bookings.noCompleted" },
        ]}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          const newTab = idx === 0 ? "current" : "completed";
          if (activeTab !== newTab) {
            setActiveTab(newTab);
          }
        }}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <FlatList
              data={item.data}
              keyExtractor={(b) => b.id}
              contentContainerStyle={[{ padding: 16, flexGrow: 1 }, bottomNavPadding]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.primary}
                  colors={[theme.primary]}
                  progressBackgroundColor={theme.background}
                />
              }
              ListEmptyComponent={
                <Text style={[styles.empty, { color: theme.textLight }]}>
                  {t(item.emptyKey)}
                </Text>
              }
              renderItem={({ item: b }) => {
                const normalizedWorkStatus = String(b.work_status || "").trim().toUpperCase();
                return (
                <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.name, { color: theme.text }]}>{b.customer_name}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        normalizedWorkStatus === "COMPLETED"
                          ? styles.completed
                          : normalizedWorkStatus === "CANCELLED"
                            ? styles.cancelled
                            : (b.payment_status === "failed" || normalizedWorkStatus === "PAYMENT FAILED")
                              ? styles.paymentFailed
                              : b.assigned_staff_email
                                ? styles.assigned
                                : styles.pending,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {normalizedWorkStatus === "COMPLETED"
                          ? t("bookings.status.completed")
                          : normalizedWorkStatus === "CANCELLED"
                            ? t("bookings.status.cancelled")
                            : (b.payment_status === "failed" || normalizedWorkStatus === "PAYMENT FAILED")
                              ? "PAYMENT FAILED"
                              : b.assigned_staff_email
                                ? t("bookings.status.assigned")
                                : t("bookings.status.pending")}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.meta, { color: theme.textLight }]}>
                    {b.booking_date} {t("bookings.at")} {b.booking_time}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textLight }]}>{t("bookings.total")}: ₹{b.total_amount}</Text>
                  <Pressable
                    style={[styles.viewBtn, { backgroundColor: theme.primary }]}
                    onPress={() => navigation.navigate("BookingDetails", { booking: b })}
                  >
                    <Text style={[styles.viewText, { color: isDark ? theme.background : "#000" }]}>{t("bookings.view")}</Text>
                  </Pressable>
                </View>
                );
              }}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* FIXED HEADER */
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 12 },

  /* TABS */
  tabs: {
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#000",
  },
  tabText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
    textAlign: "center",
  },
  activeTabText: {
    color: "#000",
  },

  /* CARD */
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  name: { fontWeight: "700", fontSize: 16, flex: 1, marginRight: 12 },
  meta: { marginTop: 6 },

  /* STATUS */
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pending: { backgroundColor: "rgba(254, 243, 199, 0.4)" },
  assigned: { backgroundColor: "rgba(219, 234, 254, 0.4)" },
  cancelled: { backgroundColor: "rgba(254, 226, 226, 0.4)" },
  paymentFailed: { backgroundColor: "rgba(254, 226, 226, 0.4)" },
  completed: { backgroundColor: "rgba(220, 252, 231, 0.4)" },
  statusText: { fontSize: 12, fontWeight: "700" },

  /* VIEW BTN */
  viewBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  viewText: { fontWeight: "700", fontSize: 15 },

  empty: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
});
