import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { LanguageProvider } from "./src/context/LanguageContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { supabase } from "./src/lib/supabase";
import AppNavigator from "./src/navigation/AppNavigator";
import { registerForPushNotificationsAsync, savePushTokenToSupabase } from "./src/utils/pushNotifications";
import { BookingCartProvider } from "./src/context/BookingCartContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";

let Notifications: any = null;
if (Constants.appOwnership !== 'expo') {
  Notifications = require('expo-notifications');
}

LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental is currently a no-op',
  'Property "transform" of AnimatedComponent(View) may be overwritten by a layout animation',
]);

export default function App() {
  const [initialRoute, setInitialRoute] = useState<"LocationAccess" | "Login" | "HomeDrawer" | "CompleteProfile">("HomeDrawer");
  const [loading, setLoading] = useState(true);
  const navigationRef = React.useRef<any>(null);
  const skipAuthRedirect = React.useRef(false);

  const handlePushToken = async (userId: string) => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await savePushTokenToSupabase(userId, token);
      }
    } catch (err) {
      console.error("Push token registration failed:", err);
    }
  };

  useEffect(() => {
    // Flag to prevent re-triggering on token refreshes
    let hasCheckedOnce = false;

    // Helper: check DB + Auth completeness
    // Returns false and redirects if profile is incomplete
    // useNav=true  → reset live navigation (post-mount, e.g. deep links)
    // useNav=false → return result so caller can set initialRoute before mount
    const checkCompleteness = async (userId: string, useNav = true): Promise<boolean> => {
      if (!userId) return true;
      try {
        // Fetch user from server
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          if (userError?.message?.includes("Refresh Token") || userError?.status === 401) {
            console.warn("Session invalid, signing out...");
            await supabase.auth.signOut();
          }
          return true;
        }

        // Check if profile exists and has a non-empty full_name
        const { data: profile } = await supabase
          .from("profile")
          .select("full_name, phone")
          .eq("id", userId)
          .maybeSingle();

        if (profile && profile.full_name && profile.full_name.trim().length > 0) {
          return true;
        }

        // Profile is incomplete -> redirect to CompleteProfileScreen
        if (useNav) {
          const rawPhone = profile?.phone || user.phone || user.user_metadata?.phone_number || "";
          const digits = rawPhone.replace(/\D/g, "").slice(-10);
          console.log("🌐 [App Debug] Incomplete profile detected! Navigating to CompleteProfile screen...");
          navigationRef.current?.reset({
            index: 0,
            routes: [
              {
                name: "CompleteProfile",
                params: { initialData: { phone: digits } }
              }
            ],
          });
        }
        return false;
      } catch (err) {
        console.error("Onboarding check error:", err);
        return true;
      }
    };

    // 1. Initial Launch Check (cold start / app kill recovery)
    const initApp = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          if (sessionError.message?.includes("Refresh Token") || sessionError.status === 400) {
            console.warn("Broken session detected on init. Clearing...");
            await supabase.auth.signOut();
            setInitialRoute("LocationAccess");
            setLoading(false);
            return;
          }
          throw sessionError;
        }

        if (session?.user) {
          handlePushToken(session.user.id);
          hasCheckedOnce = true;
        }
        
        setInitialRoute("LocationAccess");
      } catch (err) {
        console.error("App init failed:", err);
        setInitialRoute("LocationAccess");
      } finally {
        setLoading(false);
      }
    };
    initApp();

    // 2. Auth state changes — check completeness before navigating to HomeDrawer
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🌐 [App Debug] onAuthStateChange event:", event, "session user:", session?.user?.id);
        if (event === "SIGNED_OUT") {
          skipAuthRedirect.current = false;
          hasCheckedOnce = false;
          return;
        }
        if (skipAuthRedirect.current && event === "SIGNED_IN") {
          console.log("Skipping auth redirect (password reset in progress)");
          return;
        }
        if (event === "SIGNED_IN" && session?.user && !hasCheckedOnce) {
          hasCheckedOnce = true;
          
          // FIX: Delay the push token request (which may open a native OS permission dialog) 
          // to ensure it doesn't background the app during the navigation transition.
          // Backgrounding during transition causes React Navigation to silently drop resets in release builds.
          setTimeout(() => {
            handlePushToken(session.user.id);
          }, 3000);
          
          setTimeout(async () => {
            console.log("🌐 [App Debug] Checking profile completeness for SIGNED_IN user...");
            const isComplete = await checkCompleteness(session.user.id, true);
            if (isComplete) {
              console.log("🌐 [App Debug] Profile complete -> Navigating to HomeDrawer");
              navigationRef.current?.reset({
                index: 0,
                routes: [{ name: "HomeDrawer" }],
              });
            }
          }, 300);
        }
      }
    );

    // 3. Deep link handler
    const handleDeepLink = async ({ url }: { url: string }) => {
      if (!url) return;
      console.log("Deep link received:", url);

      if (url.includes("google-auth")) {
        const fragment = url.split("#")[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            hasCheckedOnce = false;
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!error && data.user) {
              handlePushToken(data.user.id);
              const isComplete = await checkCompleteness(data.user.id);
              if (isComplete) {
                navigationRef.current?.reset({
                  index: 0,
                  routes: [{ name: "HomeDrawer" }],
                });
              }
            }
          }
        }
      } else if (url.includes("reset-password") || url.includes("type=recovery")) {
        // Set flag to prevent onAuthStateChange from redirecting to Home
        skipAuthRedirect.current = true;

        // Supabase tokens can be in the fragment (#) or query (?)
        const searchPart = url.includes("#") ? url.split("#")[1] : url.split("?")[1];

        if (searchPart) {
          const params = new URLSearchParams(searchPart);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            console.log("✅ Reset tokens detected. Navigating to ResetPassword...");

            // Add a small delay for navigation to ensure navigationRef is ready
            setTimeout(() => {
              navigationRef.current?.reset({
                index: 0,
                routes: [
                  {
                    name: "ResetPassword",
                    params: {
                      access_token: accessToken,
                      refresh_token: refreshToken,
                    },
                  },
                ],
              });
            }, 800);
          }
        }
      }
    };

    // Check for initial URL (Cold Start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Listen for notification taps to handle navigation (Skip in Expo Go)
    let notificationResponseSubscription: any = null;
    if (Constants.appOwnership !== 'expo') {
      notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        if (data?.screen === 'bookings') {
          navigationRef.current?.navigate('HomeDrawer', {
            screen: 'AuthenticatedScreens',
            params: {
              screen: 'MainTabs',
              params: { screen: 'MyBookingsTab' }
            }
          });
        }
      });
    }

    return () => {
      listener.subscription.unsubscribe();
      subscription.remove();
      if (notificationResponseSubscription) notificationResponseSubscription.remove();
    };
  }, []);



  const linking: any = {
    prefixes: [
      Linking.createURL("/"),
      "neatifynation://",
      "theneatifyteam://",
      "https://www.theneatifyteam.in",
      "https://theneatifyteam.in"
    ],
    config: {
      screens: {
        HomeDrawer: {
          screens: {
            AuthenticatedScreens: {
              screens: {
                MainTabs: {
                  screens: {
                    HomeTab: {
                      screens: {
                        ServiceDetail: "service/:serviceId",
                        HomeMain: "*"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
    },
    // Handle unmatched URLs gracefully
    async getInitialURL() {
      const url = await Linking.getInitialURL();
      if (url) {
        console.log("Deep link opened app:", url);
        console.log("Parsing serviceId from URL:", url.match(/service\/([^/?]+)/)?.[1]);
      }
      return url;
    },
    subscribe(listener: (url: string) => void) {
      const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
        console.log("Deep link received:", url);
        const serviceIdMatch = url.match(/service\/([^/?]+)/);
        if (serviceIdMatch) {
          console.log("Extracted serviceId:", serviceIdMatch[1]);
        } else {
          console.log("Deep link: No serviceId found, will navigate to Home");
        }
        listener(url);
      });

      return () => {
        linkingSubscription.remove();
      };
    },
  };


  if (loading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <NotificationProvider>
              <BookingCartProvider>
                <ThemedAppContent
                  linking={linking}
                  navigationRef={navigationRef}
                  initialRoute={initialRoute}
                />
              </BookingCartProvider>
            </NotificationProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedAppContent({ linking, navigationRef, initialRoute }: any) {
  const { theme, isDark } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
      notification: theme.primary,
    },
  };

  return (
    <>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      <NavigationContainer linking={linking} ref={navigationRef} theme={navTheme}>
        <AppNavigator initialRouteName={initialRoute} />
      </NavigationContainer>
    </>
  );
}

// Force rebuild 1


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});