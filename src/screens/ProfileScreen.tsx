import { useNavigation } from "@react-navigation/native";
import { Copy, Edit2, Gift, Phone, Save, Share as ShareIcon, Wallet, X } from "lucide-react-native";
import React, { memo, useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";


import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Clipboard
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../components/Header";
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";

// import LanguageSelector from "../components/LanguageSelector"; // REMOVED
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";
import { registerForPushNotificationsAsync, removePushTokenFromSupabase } from "../utils/pushNotifications";
import { generateReferralCode } from "../utils/referralUtils";
import { isTempEmail } from "../utils/authUtils";

/* ======================================================
   FIELD CARD (MOVED OUTSIDE – FIXES KEYBOARD ISSUE)
====================================================== */

type FieldCardProps = {
  label: string;
  value: string;
  isEditing: boolean;
  editable?: boolean;
  multiline?: boolean;
  keyboardType?: any;
  maxLength?: number;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  valueStyle?: any;
};

const FieldCard = memo(
  ({
    label,
    value,
    isEditing,
    editable,
    multiline,
    keyboardType,
    maxLength,
    onChangeText,
    placeholder,
    fallback,
    valueStyle,
  }: FieldCardProps & { fallback?: string }) => {
    const { theme } = useTheme();
    return (
      <View style={[styles.fieldCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>

        {isEditing && editable ? (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.textLight}
            style={[
              styles.input,
              { backgroundColor: theme.surfaceVariant, borderColor: theme.border, color: theme.text },
              multiline ? styles.inputMultiline : null,
            ]}
            multiline={multiline}
            keyboardType={keyboardType}
            maxLength={maxLength}
            blurOnSubmit={!multiline}
          />
        ) : (
          <Text style={[styles.value, { color: theme.text }, valueStyle]}>
            {value?.trim() ? value : fallback || "--"}
          </Text>
        )}
      </View>
    );
  }
);

/* ======================================================
   PROFILE SCREEN
====================================================== */

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { showAlert, showToast } = useNotification();
  const { t } = useLanguage();
  const bottomNavPadding = useBottomNavPadding();

  const formatDisplayPhone = (phone: string | undefined | null) => {
    if (!phone) return "";
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    // If it starts with 91 and has 12 digits total, strip 91
    if (digits.length === 12 && digits.startsWith("91")) {
      return digits.slice(2);
    }
    // Return last 10 digits if possible, otherwise return cleaned string
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    address: "",
    pincode: "",
  });

  const [referralCode, setReferralCode] = useState<string>("");
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const fetchProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserId(user.id);

      const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        let currentCode = data.referral_code;

        // If no referral code exists, generate and save one
        if (!currentCode) {
          currentCode = generateReferralCode(data.full_name || user.email || "User");
          await supabase
            .from("profile")
            .update({ referral_code: currentCode })
            .eq("id", user.id);
        }

        setReferralCode(currentCode);

        const dbEmail = data.email || user.email || "";
        const finalEmail = isTempEmail(dbEmail) ? "" : dbEmail;

        setFormData({
          full_name: data.full_name || "",
          email: finalEmail,
          phone: data.phone || "",
          address: data.address || "",
          pincode: data.pincode || "",
        });

        // Fetch Wallet Balance
        const { data: walletData } = await supabase
          .from("wallet")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();

        if (walletData) {
          setWalletBalance(walletData.balance || 0);
        } else {
          // Initialize wallet if it doesn't exist
          await supabase.from("wallet").insert({ user_id: user.id, balance: 0 });
          setWalletBalance(0);
        }
      } else {
        const fallbackEmail = user.email || "";
        const finalFallback = isTempEmail(fallbackEmail) ? "" : fallbackEmail;
        setFormData((p) => ({
          ...p,
          email: finalFallback,
        }));
      }
    } catch {
      showAlert({
        type: "error",
        title: t("common.error"),
        message: t("notifications.profileLoadError")
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  /* ================= UPDATE PROFILE ================= */

  const handleUpdate = async () => {
    if (!userId) return;

    if (formData.pincode && formData.pincode.length !== 6) {
      showAlert({
        type: "warning",
        title: t("notifications.invalidPin"),
        message: t("notifications.pinCodeError")
      });
      return;
    }

    setSaving(true);

    try {
      // Clean the phone to 10 digits
      const cleanPhone = formData.phone.replace(/\D/g, "").slice(-10);
      const formattedPhone = `+91${cleanPhone}`;

      // Update profile table
      const { error } = await supabase
        .from("profile")
        .update({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          phone: cleanPhone,
          address: formData.address.trim(),
          pincode: formData.pincode.trim(),
        })
        .eq("id", userId);

      // Also sync phone to Supabase Auth metadata
      await supabase.auth.updateUser({
        data: {
          phone_number: formattedPhone
        }
      });

      if (error) throw error;

      showToast(t("notifications.profileUpdated"), "success");
      setIsEditing(false);
    } catch (err: any) {
      showAlert({
        type: "error",
        title: t("notifications.updateFailed"),
        message: err.message
      });
    } finally {
      setSaving(false);
    }
  };

  /* ================= CUSTOMER CARE ================= */

  const handleCallCustomerCare = () => {
    const phoneNumber = "tel:7617618567";
    Linking.canOpenURL(phoneNumber)
      .then((supported: boolean) => {
        if (supported) {
          Linking.openURL(phoneNumber);
        } else {
          showAlert({
            type: "error",
            title: t("common.error"),
            message: t("notifications.callError")
          });
        }
      })
      .catch(() => showAlert({
        type: "error",
        title: t("common.error"),
        message: t("notifications.dialerError")
      }));
  };

  const handleShareReferral = async () => {
    try {
      const message = `Hey! Join me on Neatify and get ₹50 off on your first home service booking. Use my referral code: ${referralCode}\n\nDownload now: https://theneatifyteam.com/download`;
      await Share.share({
        message,
        title: "Refer & Earn",
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  const copyToClipboard = () => {
    Clipboard.setString(referralCode);
    showToast("Code copied to clipboard!", "success");
  };

  /* ================= LOGOUT ================= */

  const handleLogout = async () => {
    showAlert({
      type: "warning",
      title: t("notifications.logoutTitle"),
      message: t("notifications.logoutMessage"),
      showCancel: true,
      confirmText: t("notifications.logoutConfirm"),
      onConfirm: async () => {
        try {
          // 1. Get the current token
          const token = await registerForPushNotificationsAsync();
          if (token) {
            // 2. Explicitly remove this token from Supabase BEFORE signing out
            // This ensures that this device stops receiving notifications for this user
            await removePushTokenFromSupabase(token);
          }
        } catch (err) {
          console.error("Failed to clear push token on logout:", err);
        } finally {
          // 3. Always sign out and redirect, even if token removal fails
          await supabase.auth.signOut();
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        }
      }
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  /* ================= LOADING ================= */



  /* ================= UI ================= */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <Header isCurved={true} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={[styles.container, { backgroundColor: theme.background }]}
          contentContainerStyle={[{ paddingHorizontal: 16 }, bottomNavPadding]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]} // Android
              tintColor={theme.primary} // iOS
              progressBackgroundColor={theme.background}
            />
          }
        >
          {/* HEADER */}
          <View style={[styles.headerCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>{t("profile.title")}</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                {t("profile.manageDetails")}
              </Text>
            </View>

            {!isEditing && (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setIsEditing(true)}
              >
                <Edit2 size={18} color="#2563eb" />
                <Text style={styles.editText}>{t("profile.edit")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* My Bookings button removed */}

          <FieldCard
            label={t("profile.fullName")}
            value={formData.full_name}
            isEditing={isEditing}
            editable
            onChangeText={(t) =>
              setFormData((p) => ({ ...p, full_name: t }))
            }
            placeholder={t("profile.fullNamePlaceholder")}
            fallback={t("profile.notProvided")}
          />

          <FieldCard
            label={t("profile.email")}
            value={formData.email}
            isEditing={isEditing}
            editable
            keyboardType="email-address"
            onChangeText={(t) =>
              setFormData((p) => ({ ...p, email: t }))
            }
            placeholder={t("profile.emailHint") || "Enter your email"}
            fallback="--"
          />

          <FieldCard
            label={t("profile.phone")}
            value={formatDisplayPhone(formData.phone)}
            isEditing={isEditing}
            editable
            keyboardType="phone-pad"
            maxLength={10}
            onChangeText={(t) => {
              // Strip non-digits and limit to 10
              let cleaned = t.replace(/\D/g, '');
              if (cleaned.startsWith('91') && cleaned.length > 10) {
                cleaned = cleaned.slice(2);
              }
              setFormData((p) => ({ ...p, phone: cleaned.slice(0, 10) }));
            }}
            placeholder={t("profile.phonePlaceholder")}
            fallback={t("profile.notProvided")}
          />

          <FieldCard
            label={t("profile.address")}
            value={formData.address}
            isEditing={isEditing}
            editable
            multiline
            onChangeText={(t) =>
              setFormData((p) => ({ ...p, address: t }))
            }
            placeholder={t("profile.addressPlaceholder")}
            fallback={t("profile.noAddress")}
            valueStyle={{ fontWeight: "normal" }}
          />

          <FieldCard
            label={t("profile.pincode")}
            value={formData.pincode}
            isEditing={isEditing}
            editable
            keyboardType="numeric"
            maxLength={6}
            onChangeText={(t) =>
              setFormData((p) => ({ ...p, pincode: t }))
            }
            placeholder={t("profile.pincodePlaceholder")}
            fallback="--"
          />

          {/* REFER & EARN SECTION */}
          {!isEditing && (
            <View style={[styles.referralCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.referralHeader}>
                <View style={[styles.referralIconContainer, { backgroundColor: "rgba(244, 196, 48, 0.15)" }]}>
                  <Gift size={22} color={COLORS.saffron} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.referralTitle, { color: theme.text }]}>Get ₹50 Discount Credits</Text>
                  <Text style={[styles.referralSubtitle, { color: theme.textMuted }]}>
                    Invite friends and get ₹50 off your next booking when they finish their first job.
                  </Text>
                </View>
              </View>

              <View style={[styles.codeContainer, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.codeLabel, { color: theme.textMuted }]}>YOUR REFERRAL CODE</Text>
                  <Text style={[styles.codeText, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>{referralCode}</Text>
                </View>
                <View style={styles.codeActions}>
                  <TouchableOpacity onPress={copyToClipboard} style={styles.iconBtn}>
                    <Copy size={20} color={theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleShareReferral} style={[styles.shareBtnSmall, { backgroundColor: theme.primary }]}>
                    <ShareIcon size={18} color={isDark ? theme.background : "#000"} />
                    <Text style={[styles.shareBtnText, { color: isDark ? theme.background : "#000" }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          )}

          {/* DISCOUNT BALANCE (WALLET BOX) */}
          {!isEditing && (
            <View style={[styles.referralCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.referralHeader}>
                <View style={[styles.referralIconContainer, { backgroundColor: "rgba(244, 196, 48, 0.15)" }]}>
                  <Wallet size={22} color={COLORS.saffron} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.referralTitle, { color: theme.text }]}>Discount Balance</Text>
                  <Text style={[styles.referralSubtitle, { color: theme.textMuted }]}>
                    Your earned rewards and referral credits. Use them for your next booking!
                  </Text>
                </View>
              </View>

              <View style={[styles.codeContainer, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.codeLabel, { color: theme.textMuted }]}>AVAILABLE BALANCE</Text>
                  <Text style={[styles.codeText, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>₹{walletBalance}</Text>
                </View>
                <View style={styles.codeActions}>
                  <View style={[styles.shareBtnSmall, { backgroundColor: theme.primary }]}>
                    <Wallet size={18} color={isDark ? theme.background : "#000"} />
                    <Text style={[styles.shareBtnText, { color: isDark ? theme.background : "#000" }]}>Credits</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Customer Care */}
          {!isEditing && (
            <TouchableOpacity
              style={[styles.customerCareCard, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={handleCallCustomerCare}
              activeOpacity={0.7}
            >
              <View style={styles.customerCareContent}>
                <View style={[styles.iconContainer, { backgroundColor: theme.primary }]}>
                  <Phone size={20} color={isDark ? theme.background : "#fff"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.customerCareLabel, { color: theme.textMuted }]}>{t("profile.customerCare")}</Text>
                  <Text style={[styles.customerCareNumber, { color: theme.text }]}>7617618567</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {isEditing ? (
            <View style={styles.rowActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => setIsEditing(false)}
              >
                <X size={18} color={theme.text} />
                <Text style={[styles.cancelText, { color: theme.text }]}>{t("profile.cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleUpdate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Save size={18} color={isDark ? theme.background : "#000"} />
                    <Text style={[styles.saveText, { color: isDark ? theme.background : "#000" }]}>{t("profile.save")}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Language Selector */}
              {/* Language Selector Removed */}
              {/* <View style={styles.fieldCard}>
              <Text style={styles.label}>{t("profile.language")}</Text>
              <View style={{ alignItems: 'flex-start', marginTop: 10 }}>
                <LanguageSelector />
              </View>
            </View> */}

              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
              >
                <Text style={styles.logoutText}>{t("profile.logout")}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ================= STYLES (UNCHANGED) ================= */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerCard: {
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    borderWidth: 1,
  },

  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { marginTop: 4, fontSize: 13 },

  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  editText: { color: "#2563eb", fontWeight: "700" },

  fieldCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },

  label: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },

  value: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
  },

  valueMuted: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#94a3b8",
  },

  hintText: { marginTop: 8, fontSize: 12, color: "#94a3b8" },

  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
  },

  inputMultiline: { height: 90, textAlignVertical: "top" },

  rowActions: { flexDirection: "row", gap: 12, marginTop: 6 },

  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  cancelText: { fontWeight: "800", fontSize: 15 },

  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.saffron ?? "#F4C430",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  saveText: { color: "#000", fontWeight: "900", fontSize: 15 },

  primaryBtn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: COLORS.saffron ?? "#F4C430",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "900" },

  logoutBtn: {
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: "rgba(211, 47, 47, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    width: "70%",
    alignSelf: "center",
  },

  logoutText: { color: "#D32F2F", fontSize: 15, fontWeight: "800" },

  customerCareCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },

  customerCareContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.saffron ?? "#F4C430",
    alignItems: "center",
    justifyContent: "center",
  },

  customerCareLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 1,
    marginBottom: 6,
  },

  customerCareNumber: {
    fontSize: 18,
    fontWeight: "700",
  },

  /* REFERRAL SECTION STYLES */
  referralCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  referralHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  referralIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  referralTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  referralSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  codeText: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
  },
  codeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    padding: 8,
  },
  shareBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
  walletSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  walletInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  walletLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  walletAmount: {
    fontSize: 20,
    fontWeight: "900",
  },
});
