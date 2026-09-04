import { Ionicons } from "@expo/vector-icons";
import { DrawerContentComponentProps, DrawerContentScrollView } from "@react-navigation/drawer";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { supabase } from "../lib/supabase";
import { registerForPushNotificationsAsync, removePushTokenFromSupabase } from "../utils/pushNotifications";
import { COLORS } from "../theme/colors";

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark, toggleTheme } = useTheme();
  const { checkAuth } = useAuthGuard();

  // Auth State
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profile')
        .select('full_name, email')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile for drawer:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await removePushTokenFromSupabase(token);
      }
    } catch (err) {
      console.error("Failed to clear push token on logout:", err);
    }
    await supabase.auth.signOut();
    props.navigation.closeDrawer();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header with Profile Info */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => props.navigation.closeDrawer()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.black} />
        </Pressable>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={40} color={COLORS.gray} />
          </View>
          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeLabelText}>
              {session && profile ? "Welcome back," : "Welcome to"}
            </Text>
            <Text style={styles.brandText}>
              {session && profile ? profile.full_name : "The Neatify Team"}
            </Text>
          </View>
        </View>

        {!session && (
          <Pressable style={styles.loginButton} onPress={() => props.navigation.navigate("Login")}>
            <Text style={styles.loginButtonText}>Login / Sign Up</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.black} />
          </Pressable>
        )}
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
        {/* Navigation Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textLight }]}>NAVIGATION</Text>

          <Pressable
            style={styles.navItem}
            onPress={async () => {
              if (await checkAuth("view your bookings")) {
                props.navigation.navigate("AuthenticatedScreens", { screen: "MainTabs", params: { screen: "MyBookingsTab" } });
              }
            }}
          >
            <View style={[styles.navIconContainer, { backgroundColor: theme.surfaceVariant }]}>
              <Ionicons name="calendar-outline" size={22} color={theme.text} />
            </View>
            <Text style={[styles.navText, { color: theme.text }]}>My Bookings</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
          </Pressable>

          <Pressable
            style={styles.navItem}
            onPress={async () => {
              if (await checkAuth("view your profile")) {
                props.navigation.navigate("AuthenticatedScreens", { screen: "MainTabs", params: { screen: "ProfileTab" } });
              }
            }}
          >
            <View style={[styles.navIconContainer, { backgroundColor: theme.surfaceVariant }]}>
              <Ionicons name="person-outline" size={22} color={theme.text} />
            </View>
            <Text style={[styles.navText, { color: theme.text }]}>Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
          </Pressable>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textLight }]}>PREFERENCES</Text>

          <View style={styles.preferenceItem}>
            <View style={[styles.modeToggleRow, { backgroundColor: isDark ? "#1F2937" : "#F1F5F9" }]}>
              <Text style={[styles.modeText, !isDark ? { color: theme.text, opacity: 1 } : { color: theme.textMuted, opacity: 0.5 }]}>LIGHT MODE</Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: isDark ? "#374151" : "#CBD5E1", true: isDark ? "#374151" : "#CBD5E1" }}
                thumbColor={isDark ? theme.primary : "#fff"}
                ios_backgroundColor={isDark ? "#374151" : "#CBD5E1"}
              />
              <Text style={[styles.modeText, isDark ? { color: theme.text, opacity: 1 } : { color: theme.textMuted, opacity: 0.5 }]}>DARK MODE</Text>
            </View>
          </View>
        </View>
      </DrawerContentScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Text style={[styles.versionText, { color: theme.textMuted }]}>The Neatify Team</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.saffron,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeLabelText: {
    fontSize: 16,
    color: '#334155',
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.black,
  },
  loginButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  logoutButton: {
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.3)',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D32F2F',
  },
  emailText: {
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
  },
  section: {
    marginTop: 30,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 16,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  navIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  navText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
  },
  preferenceItem: {
    marginBottom: 8,
  },
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeModeText: {
    color: '#475569',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  versionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
  },
  madeWithRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  madeWithText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  }
});
