import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useAuthListener(navigation: any) {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle token refresh errors
      if (event === "TOKEN_REFRESHED" && !session) {
        console.log("⚠️ Token refresh failed, clearing session");
        await supabase.auth.signOut();
        await AsyncStorage.removeItem("supabase.auth.token");
      }

      if (session) {
        navigation.reset({
          index: 0,
          routes: [{ name: "Home" }],
        });
      }
    });

    // Handle refresh token errors globally
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.log("⚠️ Session error:", error.message);
          if (error.message.includes("refresh_token_not_found") ||
            error.message.includes("Invalid Refresh Token")) {
            console.log("🔄 Clearing invalid session");
            await supabase.auth.signOut();
            await AsyncStorage.clear();
          }
        }
      } catch (err) {
        console.error("Error checking session:", err);
      }
    };

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [navigation]);
}