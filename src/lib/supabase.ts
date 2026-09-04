import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL ||
  ""
).trim();

const SUPABASE_ANON_KEY = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  ""
).trim();

if (!SUPABASE_URL) {
  console.warn("⚠️ [Supabase] EXPO_PUBLIC_SUPABASE_URL is missing in environment variables!");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ✅ Helper function to fetch services in fixed order
export const fetchServices = async () => {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
};


// Export the URL for constructing storage URLs
export { SUPABASE_URL };

