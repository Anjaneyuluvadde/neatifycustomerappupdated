import { supabase } from "../lib/supabase";

/**
 * Generates a random referral code
 * Format: NEAT-XXXX (where X is uppercase alphanumeric)
 */
export const generateReferralCode = (name: string): string => {
  const prefix = "NEAT";
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  // We can also use parts of the name if preferred, e.g., NEAT-JOHN-A1B2
  const namePart = name ? name.split(' ')[0].substring(0, 3).toUpperCase() : "";
  return `${prefix}-${namePart}${randomStr}`;
};

/**
 * Checks if a referral code exists and returns the referrer's profile ID
 */
export const validateReferralCode = async (code: string): Promise<string | null> => {
  if (!code) return null;
  
  try {
    const { data, error } = await supabase
      .from("profile")
      .select("id")
      .eq("referral_code", code.trim().toUpperCase())
      .single();

    if (error || !data) return null;
    return data.id;
  } catch (error) {
    console.error("Error validating referral code:", error);
    return null;
  }
};
