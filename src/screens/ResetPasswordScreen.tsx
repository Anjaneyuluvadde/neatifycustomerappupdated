import { useNavigation, useRoute } from "@react-navigation/native";
import { Lock, Mail, Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
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
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";

export default function ResetPasswordScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();

    // If accessToken is passed via deep link, we're in "set new password" mode
    const accessToken = route.params?.access_token;
    const refreshToken = route.params?.refresh_token;
    const isSettingPassword = !!(accessToken && refreshToken);

    const { showAlert, showToast } = useNotification();
    const { theme, isDark } = useTheme();

    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // ── STEP 1: Send reset email ──────────────────────────────────────────────
    const handleSendResetEmail = async () => {
        if (!email.trim()) {
            showAlert({ type: "warning", title: "Email Required", message: "Please enter your email." });
            return;
        }
        setLoading(true);
        try {
            const redirectTo = "theneatifyteam://reset-password";
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
            if (error) throw error;
            showAlert({ type: "success", title: "Reset Link Sent 📧", message: "Check your inbox for the reset link!" });
        } catch (err: any) {
            showAlert({ type: "error", title: "Error", message: err.message });
        } finally {
            setLoading(false);
        }
    };

    // ── STEP 2: Update to new password ───────────────────────────────────────
    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            showAlert({ type: "warning", title: "Weak Password", message: "Password must be at least 6 characters." });
            return;
        }
        if (newPassword !== confirmPassword) {
            showAlert({ type: "error", title: "Mismatch", message: "Passwords do not match." });
            return;
        }
        setLoading(true);
        try {
            // Set session first using tokens from the deep link
            const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (sessionError) throw sessionError;

            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            // Success — sign out first so user logs in fresh with new password
            await supabase.auth.signOut();
            showAlert({
                type: "success",
                title: "Password Updated 🎉",
                message: "Your password has been updated. Please login with your new password.",
                onConfirm: () => {
                    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
                }
            });
        } catch (err: any) {
            showAlert({ type: "error", title: "Error", message: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

                    <TouchableOpacity onPress={() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })} style={styles.back}>
                        <Text style={[styles.backText, { color: theme.primary }]}>← Back to Login</Text>
                    </TouchableOpacity>

                    <Text style={[styles.title, { color: theme.text }]}>
                        {isSettingPassword ? "Set New Password" : "Forgot Password?"}
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.textLight }]}>
                        {isSettingPassword
                            ? "Enter and confirm your new password."
                            : "Enter your email and we'll send you a reset link."}
                    </Text>

                    {isSettingPassword ? (
                        /* ── SET NEW PASSWORD ─────────────── */
                        <>
                            <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                <Lock size={20} color={theme.textLight} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder="New Password"
                                    placeholderTextColor={theme.textLight}
                                    secureTextEntry={!showNewPassword}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                                    {showNewPassword ? <EyeOff size={20} color={theme.textLight} /> : <Eye size={20} color={theme.textLight} />}
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                <Lock size={20} color={theme.textLight} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder="Confirm New Password"
                                    placeholderTextColor={theme.textLight}
                                    secureTextEntry={!showConfirmPassword}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    {showConfirmPassword ? <EyeOff size={20} color={theme.textLight} /> : <Eye size={20} color={theme.textLight} />}
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={handleUpdatePassword} disabled={loading}>
                                {loading ? <ActivityIndicator color={theme.background} /> : <Text style={[styles.btnText, { color: theme.background }]}>Update Password</Text>}
                            </TouchableOpacity>
                        </>
                    ) : (
                        /* ── SEND RESET EMAIL ─────────────── */
                        <>
                            <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                <Mail size={20} color={theme.textLight} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder="Your email address"
                                    placeholderTextColor={theme.textLight}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>
                            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={handleSendResetEmail} disabled={loading}>
                                {loading ? <ActivityIndicator color={theme.background} /> : <Text style={[styles.btnText, { color: theme.background }]}>Send Reset Link</Text>}
                            </TouchableOpacity>
                        </>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 25, paddingTop: 20 },
    back: { marginBottom: 30 },
    backText: { color: COLORS.saffron, fontWeight: "700", fontSize: 15 },
    title: { fontSize: 28, fontWeight: "800", color: COLORS.text, marginBottom: 8 },
    subtitle: { color: COLORS.textLight, fontSize: 15, marginBottom: 30, lineHeight: 22 },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1.5,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 14,
    },
    input: { flex: 1, fontSize: 16, marginLeft: 10, color: COLORS.text },
    btn: {
        backgroundColor: COLORS.saffron,
        height: 56,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 6,
    },
    btnText: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
});
