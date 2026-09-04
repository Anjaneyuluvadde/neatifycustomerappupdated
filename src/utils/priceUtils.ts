import AsyncStorage from "@react-native-async-storage/async-storage";

export type ClaimedOffer = {
  type?: "NEW_USER" | "GENERIC_OFFER" | "PROMOTIONAL_BANNER";
  bannerId?: string | null;
  serviceId?: string | null;
  serviceTitle?: string | null;
  offerPercentage: number;
  offerPrice?: number | null;
  claimedAt: string;
};

const CLAIMED_OFFER_KEY = "claimedOffer";

export const getClaimedOffer = async (): Promise<ClaimedOffer | null> => {
  try {
    const json = await AsyncStorage.getItem(CLAIMED_OFFER_KEY);
    if (!json) return null;
    return JSON.parse(json) as ClaimedOffer;
  } catch (e) {
    console.error("Error reading claimed offer:", e);
    return null;
  }
};

export const setClaimedOffer = async (offer: ClaimedOffer): Promise<void> => {
  try {
    await AsyncStorage.setItem(CLAIMED_OFFER_KEY, JSON.stringify(offer));
  } catch (e) {
    console.error("Error saving claimed offer:", e);
  }
};

export const clearClaimedOffer = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CLAIMED_OFFER_KEY);
  } catch (e) {
    console.error("Error clearing claimed offer:", e);
  }
};

export const calculateServicePrice = (
  service: any,
  offersData: any[] = [],
  claimedOffer: ClaimedOffer | null = null
) => {
  if (!service) return null;

  // 1. Session-claimed offers are now applied as coupons at checkout.
  // 2. Check for active global offers in Supabase
  const matchingOffer = (offersData || []).find((o) => o.title === service.title);

  let finalPrice = String(service.price);
  let finalPct = parseFloat(service.discount_percent) || 0;
  let finalLabel =
    (service.discount_label ? String(service.discount_label).toUpperCase() : null) ||
    (finalPct > 0 ? `${finalPct}% OFF` : null);

  if (matchingOffer) {
    const offerPct = parseFloat(matchingOffer.offer_percentage) || 0;
    const offerPrice = matchingOffer.offer_price || matchingOffer.fixed_price;
    const rawOrig = service.original_price ?? service.price;
    const originalPrice = parseFloat(String(rawOrig).replace(/[^\d.]/g, "")) || 0;

    if (offerPrice !== undefined && offerPrice !== null) {
      finalPrice = String(offerPrice);
    } else if (originalPrice > 0 && offerPct > 0) {
      finalPrice = String(Math.round(originalPrice * (1 - offerPct / 100)));
    }

    finalPct = offerPct;
    finalLabel = offerPct > 0 ? `${offerPct}% OFF` : "SPECIAL OFFER";
  }

  return {
    price: finalPrice,
    discount_percent: finalPct,
    discount_label: finalLabel,
    isClaimed: false,
  };
};
