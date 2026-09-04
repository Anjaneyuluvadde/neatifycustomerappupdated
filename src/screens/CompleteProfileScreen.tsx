import { useNavigation, useRoute } from "@react-navigation/native";
import { ChevronLeft, Eye, EyeOff, Gift, Lock, Mail, Phone, User } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";
import { generateReferralCode, validateReferralCode } from "../utils/referralUtils";
import { isTempEmail } from "../utils/authUtils";

export default function CompleteProfileScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { initialData } = route.params || {};
    const { showAlert, showToast } = useNotification();
    const { theme, isDark } = useTheme();

    const [fullName, setFullName] = useState(initialData?.fullName || "");
    const [email, setEmail] = useState(initialData?.email || "");
    const [phone, setPhone] = useState(() => {
        const raw = initialData?.phone || "";
        const digits = raw.replace(/\D/g, "");
        return digits.length > 10 ? digits.slice(-10) : digits;
    });
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [referralCode, setReferralCode] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Auth state flags
    const [needsEmail, setNeedsEmail] = useState(true);
    const [needsPassword, setNeedsPassword] = useState(false);

    useEffect(() => {
        loadCurrentData();
    }, []);

    const loadCurrentData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (!user) {
                navigation.replace("Login");
                return;
            }

            const cleanPhoneHelper = (raw?: string | null) => {
                if (!raw) return "";
                const digits = raw.replace(/\D/g, "");
                return digits.slice(-10);
            };

            const routePhone = initialData?.phone || "";
            let extractedPhone = cleanPhoneHelper(routePhone) || cleanPhoneHelper(user.user_metadata?.phone_number) || cleanPhoneHelper(user.user_metadata?.phone) || cleanPhoneHelper(user.phone);
            setPhone(extractedPhone);

            const authEmail = user.email || "";
            if (!isTempEmail(authEmail)) {
                setEmail(authEmail);
            } else {
                setEmail("");
            }

            if (user.user_metadata?.full_name) {
                setFullName(user.user_metadata.full_name);
            }

            const { data: profile } = await supabase
                .from("profile")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            if (profile) {
                if (profile.full_name) setFullName(profile.full_name);
                if (profile.email && !isTempEmail(profile.email)) setEmail(profile.email);
                if (profile.phone) setPhone(cleanPhoneHelper(profile.phone));
            }
        } catch (error) {
            console.log("Error loading user data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.replace("HomeDrawer");
        }
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No authenticated user found.");

            if (!fullName.trim()) {
                showAlert({ type: "warning", title: "Missing Name", message: "Please enter your full name." });
                setSaving(false);
                return;
            }

            let finalEmailToSave = email.trim();
            if (finalEmailToSave && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmailToSave)) {
                showAlert({ type: "warning", title: "Invalid Email", message: "Please enter a valid email address." });
                setSaving(false);
                return;
            }

            const cleanPhoneHelper = (raw?: string | null) => {
                if (!raw) return "";
                return raw.replace(/\D/g, "").slice(-10);
            };

            let verifiedPhone = cleanPhoneHelper(phone) || cleanPhoneHelper(user.phone) || cleanPhoneHelper(initialData?.phone);
            if (!verifiedPhone || verifiedPhone.length < 10) {
                showAlert({ type: "warning", title: "Invalid Phone", message: "Please enter a valid 10-digit phone number." });
                setSaving(false);
                return;
            }

            let referrerId = null;
            if (referralCode.trim()) {
                referrerId = await validateReferralCode(referralCode.trim());
                if (!referrerId) {
                    showAlert({ type: "warning", title: "Invalid Referral", message: "The referral code you entered is invalid. You can continue without it." });
                    setSaving(false);
                    return;
                }
            }

            const myReferralCode = generateReferralCode(fullName.trim());

            // 1. Try invoking save-profile Edge Function for direct auth.users update
            let savedViaEdge = false;
            try {
                const { data: edgeData, error: edgeErr } = await supabase.functions.invoke("save-profile", {
                    body: {
                        userId: user.id,
                        fullName: fullName.trim(),
                        email: finalEmailToSave,
                        phone: verifiedPhone,
                        referralCode: myReferralCode,
                        referredById: referrerId
                    }
                });

                if (!edgeErr && edgeData?.success) {
                    savedViaEdge = true;
                    console.log("✅ Profile & Auth saved via save-profile Edge Function!");
                }
            } catch (edgeEx) {
                console.warn("⚠️ save-profile edge function call fallback:", edgeEx);
            }

            // 2. Client-side fallback if Edge Function isn't deployed yet
            if (!savedViaEdge) {
                const { error: profileError } = await supabase
                    .from("profile")
                    .upsert({
                        id: user.id,
                        full_name: fullName.trim(),
                        email: finalEmailToSave || null,
                        phone: verifiedPhone,
                        referral_code: myReferralCode,
                        referred_by_id: referrerId,
                    });

                if (profileError) {
                    console.error("PROFILE SAVE FAILED", profileError);
                    throw profileError;
                }

                const authPayload: any = {
                    data: {
                        full_name: fullName.trim(),
                        phone_number: `+91${verifiedPhone}`
                    }
                };
                if (finalEmailToSave) {
                    authPayload.email = finalEmailToSave;
                }
                await supabase.auth.updateUser(authPayload);

                await supabase.from("wallet").upsert({
                    user_id: user.id,
                    balance: 0
                });
            }

            showToast("Profile updated!", "success");
            navigation.reset({
                index: 0,
                routes: [{ name: "HomeDrawer" }],
            });
        } catch (error: any) {
            console.error("Error saving profile:", error);
            showAlert({
                type: "error",
                title: "Update Failed",
                message: error?.message || "Failed to save profile."
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={handleBack}
                            style={styles.backButton}
                        >
                            <ChevronLeft size={28} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: theme.text }]}>Complete Your Profile</Text>
                        <Text style={[styles.subtitle, { color: theme.textLight }]}>
                            Just a few details to get you started.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {/* FULL NAME */}
                        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                            <User size={20} color={theme.textLight} />
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Full Name"
                                placeholderTextColor={theme.textLight}
                                value={fullName}
                                onChangeText={setFullName}
                            />
                        </View>

                        {/* EMAIL */}
                        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                            <Mail size={20} color={theme.textLight} />
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Email Address (Optional)"
                                placeholderTextColor={theme.textLight}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        {/* PHONE NUMBER */}
                        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                            <Phone size={20} color={theme.textLight} />
                            <Text style={{ marginLeft: 10, fontSize: 16, color: theme.text, fontWeight: '600' }}>+91</Text>
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Phone Number"
                                placeholderTextColor={theme.textLight}
                                value={phone}
                                onChangeText={(text) => {
                                    const cleaned = text.replace(/\D/g, '').slice(0, 10);
                                    setPhone(cleaned);
                                }}
                                keyboardType="phone-pad"
                                maxLength={10}
                            />
                        </View>

                        {/* REFERRAL CODE (Optional) */}
                        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                            <Gift size={20} color={theme.textLight} />
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Referral Code (Optional)"
                                placeholderTextColor={theme.textLight}
                                value={referralCode}
                                onChangeText={setReferralCode}
                                autoCapitalize="characters"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: theme.primary }, saving && styles.disabledBtn]}
                            onPress={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color={theme.background} />
                            ) : (
                                <Text style={[styles.primaryText, { color: theme.background }]}>
                                    Save & Continue
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 25 },
    header: { marginBottom: 30, marginTop: 10 },
    backButton: {
        marginLeft: -10,
        marginBottom: 15,
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    title: { fontSize: 24, fontWeight: "800", color: COLORS.text, marginBottom: 8 },
    subtitle: { fontSize: 16, color: COLORS.textLight },
    form: { gap: 16 },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    input: { flex: 1, fontSize: 16, marginLeft: 10, color: COLORS.text },
    primaryBtn: {
        backgroundColor: COLORS.saffron,
        height: 56,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 20,
    },
    disabledBtn: {
        backgroundColor: COLORS.inputBorder,
        opacity: 0.7,
    },
    primaryText: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
});
