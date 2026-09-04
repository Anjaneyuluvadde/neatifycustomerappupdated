import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LocationService from "../services/LocationService";
import { isTempEmail } from "../utils/authUtils";

import AnimatedGradientBorder from "../components/AnimatedGradientBorder";
import Header from "../components/Header";
import LoadingOverlay from "../components/LoadingOverlay";
import TermsModal from "../components/TermsModal";

import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";
import { invokeFunction } from "../lib/backendClient";
import { processPayment } from "../lib/paymentService";
import { supabase } from "../lib/supabase";
import { RootStackParamList, SelectedService } from "../navigation/AppNavigator";
import { COLORS } from "../theme/colors";
import { clearClaimedOffer, getClaimedOffer } from "../utils/priceUtils";

/* ================= TYPES ================= */

type CheckoutRouteProp = RouteProp<RootStackParamList, "Checkout">;

type Props = {
  route: CheckoutRouteProp;
};

type Profile = {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
};

type Policies = {
  user_policies: string;
  terms_and_conditions: string;
};

/* ================= HELPERS ================= */

const parseDurationToMinutes = (duration: string) => {
  let minutes = 0;
  const hrMatch = duration.match(/(\d+)\s*hr/);
  const minMatch = duration.match(/(\d+)\s*min/);

  if (hrMatch) minutes += parseInt(hrMatch[1]) * 60;
  if (minMatch) minutes += parseInt(minMatch[1]);

  return minutes;
};

const formatMinutes = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} hrs ${m} mins`;
  if (h) return `${h} hrs`;
  return `${m} mins`;
};

const parsePrice = (price: string) => Number(price.replace(/[^\d]/g, ""));

const formatDisplayPhone = (phone: string | undefined | null) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/* ================= COMPONENT ================= */

export default function CheckoutScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const bottomNavPadding = useBottomNavPadding();
  const { services: initialServices, bookingDateText } = route.params;
  const [checkoutServices, setCheckoutServices] = useState<SelectedService[]>(initialServices || []);

  useEffect(() => {
    // ❌ Removed applyClaimedOfferToCheckout that modifies service prices directly.
    // We now apply it as a coupon code automatically.
  }, []);

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [invoiceEmail, setInvoiceEmail] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  // Checkbox states for policies and terms
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Modal states
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'error' | 'info' | 'warning';
  }>({ title: '', message: '', type: 'error' });

  // Address Form State
  const [manualAddress, setManualAddress] = useState("");
  const [pincode, setPincode] = useState("");

  // Location coordinates (not displayed, only stored in booking)
  const [bookingLatitude, setBookingLatitude] = useState<number | null>(null);
  const [bookingLongitude, setBookingLongitude] = useState<number | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [isAddressSummaryMode, setIsAddressSummaryMode] = useState(true);
  const [hasUsedLocationFetch, setHasUsedLocationFetch] = useState(true);

  // ✅ Pincode verification state
  const [isPincodeServiceable, setIsPincodeServiceable] = useState<boolean>(false);
  const [checkingPincode, setCheckingPincode] = useState<boolean>(false);

  // ✅ Dynamic Policies State
  const [policies, setPolicies] = useState<Policies | null>(null);

  // ✅ Coupon state
  const [coupon, setCoupon] = useState<{ id: string; coupon_code: string; discount_percentage?: number; discount_amount?: number; source?: "MANUAL_COUPON" | "PROMOTIONAL_BANNER" | "SERVICE_DISCOUNT" | "NEW_USER" | "GENERIC_OFFER" | "MANUAL_ENTRY" } | null>(null);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState(0);

  /* ================= TOTALS (PRE-DECLARED FOR EFFECT) ================= */

  const totalPrice = useMemo(
    () => checkoutServices.reduce((sum, s) => {
      const qty = s.quantity || 1;
      return sum + (parsePrice(s.price) * qty);
    }, 0),
    [checkoutServices]
  );

  const totalOriginalPrice = useMemo(
    () => checkoutServices.reduce((sum, s) => {
      const qty = s.quantity || 1;
      if (s.original_price && Number(String(s.original_price).replace(/[^\d.]/g, '')) > 0) {
        return sum + (Number(String(s.original_price).replace(/[^\d.]/g, '')) * qty);
      }
      return sum + (parsePrice(s.price) * qty);
    }, 0),
    [checkoutServices]
  );

  const calculatedCouponDiscountAmount = useMemo(() => {
    if (!couponApplied || !coupon) return 0;
    if (coupon.discount_amount && coupon.discount_amount > 0) {
      return coupon.discount_amount;
    }
    const baseForDiscount = totalOriginalPrice > 0 ? totalOriginalPrice : totalPrice;
    return Number(((baseForDiscount * couponDiscount) / 100).toFixed(2));
  }, [couponApplied, coupon, totalOriginalPrice, totalPrice, couponDiscount]);

  const effectiveSubtotal = useMemo(() => {
    if (couponApplied && coupon) {
      const baseForDiscount = totalOriginalPrice > 0 ? totalOriginalPrice : totalPrice;
      return Math.max(0, baseForDiscount - calculatedCouponDiscountAmount);
    }
    return totalPrice;
  }, [couponApplied, coupon, totalOriginalPrice, totalPrice, calculatedCouponDiscountAmount]);

  const totalEffectiveSavings = useMemo(() => {
    const baseOrig = totalOriginalPrice > 0 ? totalOriginalPrice : totalPrice;
    return Math.max(0, baseOrig - effectiveSubtotal);
  }, [totalOriginalPrice, totalPrice, effectiveSubtotal]);

  // ✅ Auto-apply Claimed Offer / Active Service Discount as a Coupon
  useEffect(() => {
    let isMounted = true;
    const applyClaimedOfferAsCoupon = async () => {
      const claimed = await getClaimedOffer();

      if (claimed) {
        console.log("[COUPON STEP 2] Claimed offer:", claimed);
        console.log("[COUPON STEP 2] Claim type:", claimed.type);

        let isValidClaim = false;

        if (claimed.serviceId || claimed.serviceTitle) {
          const matchesService = checkoutServices.some((s) => {
            if (claimed.serviceId && s.id === claimed.serviceId) return true;
            if (
              claimed.serviceTitle &&
              (s.title?.toLowerCase().trim() === claimed.serviceTitle?.toLowerCase().trim() ||
                s.service_type?.toLowerCase().trim() === claimed.serviceTitle?.toLowerCase().trim())
            ) {
              return true;
            }
            return false;
          });

          if (!matchesService) {
            console.log("ℹ️ Offer is restricted to a different service. Discount not applied.");
          } else {
            isValidClaim = true;
          }
        } else {
          isValidClaim = true;
        }

        if (isValidClaim) {
          const pct = claimed.offerPercentage || 40;

          if (claimed.type === "NEW_USER") {
            const { data: { session } } = await supabase.auth.getSession();
            let bookingCount = 0;
            if (session?.user) {
              const { count } = await supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', session.user.id)
                .eq('payment_verified', true)
                .ilike('payment_status', 'paid');
              bookingCount = count || 0;
            }
            
            console.log("[COUPON STEP 2] Booking count:", bookingCount);
            if (bookingCount > 0) {
              console.log("[COUPON STEP 2] Eligibility: EXISTING USER. Rejecting NEW_USER offer.");
            } else {
              console.log("[COUPON STEP 2] Eligibility: NEW USER. Applying offer.");
              if (!isMounted) return;
              setCoupon({
                id: "claimed_new_user",
                coupon_code: `NEW${pct}_OFFER`,
                discount_percentage: pct,
                discount_amount: 0,
                source: "NEW_USER",
              });
              setCouponDiscount(pct);
              setCouponApplied(true);
              setCouponStatus({ type: 'success', message: `Coupon applied! ${pct}% off for ${claimed.serviceTitle || "selected service"}` });
              console.log("[COUPON STEP 2] Coupon applied: true");
              console.log(`[COUPON STEP 2] Final coupon code: NEW${pct}_OFFER`);
              return;
            }
          } else if (claimed.type === "PROMOTIONAL_BANNER") {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user && claimed.bannerId) {
              const { count, error } = await supabase
                .from("bookings")
                .select("id", { count: "exact", head: true })
                .eq("user_id", session.user.id)
                .eq("promotional_banner_id", claimed.bannerId)
                .eq("payment_verified", true)
                .ilike("payment_status", "paid");

              console.log("[COUPON STEP 7] PROMOTIONAL_BANNER redemption check:", {
                bannerId: claimed.bannerId,
                count,
                error
              });

              if (error) {
                console.error("[COUPON STEP 7] Error checking promotional banner redemption:", error);
                return;
              }

              if (count && count > 0) {
                console.log("[COUPON STEP 7] PROMOTIONAL_BANNER already redeemed. Blocking reuse.");
                await clearClaimedOffer();
                setCoupon(null);
                setCouponApplied(false);
                setCouponDiscount(0);
                return;
              }
            }

            console.log("[COUPON STEP 8] Eligibility: PROMOTIONAL_BANNER. Applying exact banner offer.");

            if (!isMounted) return;
            const promoCode = claimed.bannerId 
              ? `PROMO_${claimed.bannerId.substring(0, 8).toUpperCase()}_${pct}OFF`
              : `PROMO_${pct}OFF`;

            setCoupon({
              id: claimed.bannerId || "claimed_promo_banner",
              coupon_code: promoCode,
              discount_percentage: pct,
              discount_amount: 0,
              source: "PROMOTIONAL_BANNER",
            });
            setCouponDiscount(pct);
            setCouponApplied(true);
            setCouponStatus({ type: 'success', message: `Promotional banner applied! ${pct}% off` });
            console.log(`[COUPON STEP 8] Final coupon: ${promoCode}`);
            return;
          } else if (claimed.type === "GENERIC_OFFER") {
            console.log("[COUPON STEP 2] Eligibility: GENERIC_OFFER. Applying offer.");
            if (!isMounted) return;
            const finalCode = `PROMO_${pct}OFF`;
            setCoupon({
              id: "claimed_generic_offer",
              coupon_code: finalCode,
              discount_percentage: pct,
              discount_amount: claimed.offerPrice || 0,
              source: "GENERIC_OFFER",
            });
            setCouponDiscount(pct);
            setCouponApplied(true);
            setCouponStatus({ type: 'success', message: `Coupon applied! ${pct}% off for ${claimed.serviceTitle || "selected service"}` });
            console.log("[COUPON STEP 2] Coupon applied: true");
            console.log(`[COUPON STEP 2] Final coupon code: ${finalCode}`);
            return;
          } else {
            console.log("[COUPON STEP 2] Eligibility: LEGACY CLAIM (type undefined). Ignoring.");
          }
        }
      }

      // If no claimed offer, check if any service in checkout has discount_percent > 0 (e.g. 40% OFF)
      const serviceWithDiscount = checkoutServices.find(s => s.discount_percent && Number(s.discount_percent) > 0);
      if (serviceWithDiscount && Number(serviceWithDiscount.discount_percent) > 0) {
        const pct = Number(serviceWithDiscount.discount_percent);
        if (!isMounted) return;
        setCoupon({
          id: "service_discount_offer",
          coupon_code: serviceWithDiscount.discount_label ? String(serviceWithDiscount.discount_label).toUpperCase().replace(/\s+/g, '') : `OFFER_${pct}%`,
          discount_percentage: pct,
          discount_amount: 0,
          source: "SERVICE_DISCOUNT",
        });
        setCouponDiscount(pct);
        setCouponApplied(true);
        setCouponStatus({ type: 'success', message: `Special ${pct}% offer applied!` });
      }
    };

    applyClaimedOfferAsCoupon();
    return () => { isMounted = false; };
  }, [checkoutServices]);

  // ✅ Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

  // ✅ Manual Coupon State
  const [manualCouponCode, setManualCouponCode] = useState("");
  const [isVerifyingCoupon, setIsVerifyingCoupon] = useState(false);
  const [couponStatus, setCouponStatus] = useState<{ type: 'success' | 'error' | '', message: string }>({ type: '', message: '' });

  const [refreshing, setRefreshing] = useState(false);

  // ✅ Centralized Geocoding Helper
  const handleManualGeocode = async (addressToGeocode: string) => {
    if (!addressToGeocode || !addressToGeocode.trim()) return null;
    try {
      console.log("📍 Geocoding address:", addressToGeocode);
      const geoResults = await Location.geocodeAsync(addressToGeocode);
      if (geoResults && geoResults.length > 0) {
        const { latitude, longitude } = geoResults[0];
        setBookingLatitude(latitude);
        setBookingLongitude(longitude);
        console.log("✅ Geocode success:", latitude, longitude);
        return { latitude, longitude };
      }
    } catch (err) {
      console.log("⚠️ Geocoding failed for:", addressToGeocode, err);
    }
    return null;
  };

  // ✅ Function to view coordinates on external map
  const handleViewOnMap = async () => {
    let currentLat = bookingLatitude;
    let currentLng = bookingLongitude;

    // Proactive geocode if coordinates are missing
    if (!currentLat || !currentLng) {
      console.log("📍 Proactive geocode for map view...");
      const result = await handleManualGeocode(`${manualAddress}, ${pincode}`);
      if (result) {
        currentLat = result.latitude;
        currentLng = result.longitude;
      }
    }

    if (!currentLat || !currentLng) {
      setAlertConfig({
        title: "Location Missing",
        message: "Please fetch or enter your address first.",
        type: "warning"
      });
      setShowAlertModal(true);
      return;
    }

    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${currentLat},${currentLng}`;
    const label = 'Service Location';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });

    if (url) {
      Linking.openURL(url).catch(err => {
        console.error("Failed to open map:", err);
      });
    }
  };

  /* ================= PINCODE CHECK FUNCTION ================= */

  const checkPincodeServiceable = async (pin: string) => {
    console.log(`[SERVICEABILITY STEP 2] Pincode received: ${pin}`);
    const cleanedPin = pin.trim();

    if (cleanedPin.length !== 6) {
      setIsPincodeServiceable(false);
      return;
    }

    try {
      setCheckingPincode(true);
      console.log(`[SERVICEABILITY STEP 2] Checking hub_locations:`);

      const { data, error } = await supabase
        .from("hub_locations")
        .select("id, hub_name, pincode, is_active")
        .eq("pincode", cleanedPin)
        .eq("is_active", true)
        .limit(1);

      if (error) {
        console.log(`[SERVICEABILITY STEP 2] Final: NOT_AVAILABLE`);
        setIsPincodeServiceable(false);
        return;
      }

      const available = Array.isArray(data) && data.length > 0;
      setIsPincodeServiceable(available);

      console.log(`[SERVICEABILITY STEP 2] Matching rows: ${data ? data.length : 0}`);
      console.log(`[SERVICEABILITY STEP 2] Matching hub: ${available ? data[0].hub_name : 'null'}`);
      console.log(`[SERVICEABILITY STEP 2] Final: ${available ? 'AVAILABLE' : 'NOT_AVAILABLE'}`);

    } catch (err: any) {
      console.log(`[SERVICEABILITY STEP 2] Final: NOT_AVAILABLE`);
      setIsPincodeServiceable(false);
    } finally {
      setCheckingPincode(false);
    }
  };

  useEffect(() => {
    checkPincodeServiceable(pincode);
  }, [pincode]);

  /* ================= FETCH COUPON ================= */

  const fetchUserCoupon = async (phone: string) => {
    if (!phone) return;

    const userPhone10 = formatDisplayPhone(phone);
    if (!userPhone10 || userPhone10.length < 10) return;

    const userPhone91 = "91" + userPhone10;
    const userPhonePlus91 = "+91" + userPhone10;

    console.log("🔍 Fetching coupon for:", userPhone10);

    const { data: couponData, error: couponError } = await supabase
      .from("coupons")
      .select("*")
      .or(`phone_number.eq.${userPhone10},phone_number.eq.${userPhone91},phone_number.eq.${userPhonePlus91}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (couponError) {
      console.log("❌ Coupon fetch error:", couponError.message);
      return;
    }

    setCoupon((prev) => {
      console.log("[COUPON STEP 5] Existing coupon before fetchUserCoupon:", prev ? prev.coupon_code : "none");

      if (prev) {
        if (couponData && !couponData.is_used) {
          console.log("[COUPON STEP 5] Manual coupon found:", couponData.coupon_code);
        } else {
          console.log("[COUPON STEP 5] Manual coupon not found");
        }
        console.log("[COUPON STEP 5] Preserving existing claimed offer coupon:", prev.coupon_code);
        console.log("[COUPON STEP 5] Final coupon state:", prev.coupon_code);
        return prev;
      }

      if (couponData && !couponData.is_used) {
        console.log("✅ Valid unused coupon found:", couponData.coupon_code);
        console.log("[COUPON STEP 5] Final coupon state:", couponData.coupon_code);
        
        // Fix for manual coupons: ensure they actually apply the discount
        setTimeout(() => {
          const discountPct = couponData.discount_percentage || couponData.discount_p || 0;
          setCouponDiscount(discountPct);
          setCouponApplied(true);
        }, 0);

        return {
          id: couponData.id,
          coupon_code: couponData.coupon_code,
          discount_percentage: couponData.discount_percentage || couponData.discount_p || 0,
          discount_amount: couponData.discount_amount || 0,
          source: "MANUAL_COUPON"
        };
      } else {
        console.log("[COUPON STEP 5] Manual coupon not found");
        console.log("[COUPON STEP 5] Final coupon state: none");
        return null;
      }
    });
  };

  useEffect(() => {
    if (profile?.phone) {
      fetchUserCoupon(profile.phone);
    }
  }, [profile?.phone]);

  /* ================= FETCH POLICIES ================= */

  const fetchPolicies = useCallback(async () => {
    const { data, error } = await supabase
      .from("app_policies")
      .select("user_policies, terms_and_conditions")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log("Error fetching policies:", error);
    } else if (data) {
      setPolicies(data as Policies);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  /* ================= LOAD PROFILE ================= */

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    setUserId(data.user.id);

    const { data: profileData, error } = await supabase
      .from("profile")
      .select("full_name,email,phone,address,pincode")
      .eq("id", data.user.id)
      .maybeSingle();

    if (error) {
      setAlertConfig({ title: 'Error', message: error.message, type: 'error' });
      setShowAlertModal(true);
      setLoadingProfile(false);
      return;
    }

    if (profileData) {
      // Apply phone formatting
      const cleanedProfile = {
        ...profileData,
        phone: formatDisplayPhone(profileData.phone)
      };
      setProfile(cleanedProfile);

      if (profileData.email && !isTempEmail(profileData.email)) {
        setInvoiceEmail(profileData.email);
      }

      // ✅ Initial coupon fetch moved to useEffect [profile?.phone]

      const cachedLoc = await LocationService.getSelectedLocation();
      const freshPin = cachedLoc?.postalCode || "";

      setPincode(freshPin);
      setManualAddress(cachedLoc?.fullAddress || "");
      if (cachedLoc) {
        setBookingLatitude(cachedLoc.latitude);
        setBookingLongitude(cachedLoc.longitude);
      }
      setIsAddressSummaryMode(true);
      setHasUsedLocationFetch(true);
    } else {
      setAlertConfig({
        title: 'Profile Not Found',
        message: 'Please complete your profile before booking',
        type: 'warning'
      });
      setShowAlertModal(true);
      navigation.navigate("MainTabs", { screen: "ProfileTab" });
    }

    // ✅ Fetch Wallet Balance
    const { data: walletData } = await supabase
      .from("wallet")
      .select("balance")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (walletData) {
      setWalletBalance(walletData.balance || 0);
    }

    setLoadingProfile(false);
  }, [navigation]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadProfile(),
      fetchPolicies(),
      profile?.phone ? fetchUserCoupon(profile.phone) : Promise.resolve(),
      pincode ? checkPincodeServiceable(pincode) : Promise.resolve()
    ]);
    setRefreshing(false);
  };

  /* ================= SCREEN FOCUS EFFECT ================= */

  useFocusEffect(
    React.useCallback(() => {
      Location.requestForegroundPermissionsAsync().catch((err) => {
        console.log("Location permission pre-request failed:", err);
      });
      return () => { };
    }, [])
  );

  /* ================= LOCATION ================= */

  const fetchCurrentLocation = async () => {
    if (!userId) return;

    setFetchingLocation(true);
    try {
      // Force GPS fetch (true) because user explicitly clicked the GPS button
      const result = await LocationService.fetchCurrentLocation(Location.Accuracy.High, true);

      if (result.status === 'permission_denied') {
        setAlertConfig({
          title: 'Permission Denied',
          message: 'Location access is required to use this feature',
          type: 'warning'
        });
        setShowAlertModal(true);
        return;
      }

      if (result.status === 'error') {
        setAlertConfig({
          title: 'Location Error',
          message: 'Could not fetch your location. Please try again or enter manually.',
          type: 'error'
        });
        setShowAlertModal(true);
        return;
      }

      setBookingLatitude(result.latitude);
      setBookingLongitude(result.longitude);

      if (result.rawAddress) {
        const addr: any = result.rawAddress;
        const fullAddr: string = addr.formattedAddress || "";

        if (fullAddr) {
          const parts = fullAddr.split(",").map((p: string) => p.trim()).filter((p: string) => p);
          let pinIdx = -1;
          for (let i = parts.length - 1; i >= 0; i--) {
            const pinMatch = parts[i].match(/\b(\d{6})\b/);
            if (pinMatch) {
              setPincode(pinMatch[1]);
              pinIdx = i;
              break;
            }
          }
          if (pinIdx === -1 && addr.postalCode) setPincode(addr.postalCode);
          setManualAddress(fullAddr || "");
          setIsAddressSummaryMode(true);
          setHasUsedLocationFetch(true);
        } else {
          setManualAddress(addr.street || addr.district || addr.subregion || result.locality || "");
          if (addr.postalCode) setPincode(addr.postalCode);
          setIsAddressSummaryMode(false);
        }
      }
    } finally {
      setFetchingLocation(false);
    }
  };

  /* ================= COUPON ================= */

  const applyCoupon = () => {
    if (!coupon) return;
    const discountPct = coupon.discount_percentage || 0;
    setCouponDiscount(discountPct);
    setCouponApplied(true);
    const msg = coupon.discount_amount && coupon.discount_amount > 0
      ? `Coupon applied! ₹${coupon.discount_amount} off`
      : `Coupon applied! ${discountPct}% off`;
    setCouponStatus({ type: 'success', message: msg });
  };

  const handleApplyManualCoupon = async () => {
    if (!manualCouponCode.trim()) return;

    setIsVerifyingCoupon(true);
    setCouponStatus({ type: '', message: '' });

    try {
      const cleanPhone = profile?.phone ? profile.phone.replace(/\D/g, "").slice(-10) : "";

      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("coupon_code", manualCouponCode.trim().toUpperCase())
        .maybeSingle();

      if (error || !data) {
        setCouponStatus({ type: "error", message: "Invalid coupon code" });
        setCouponApplied(false);
      } else if (data.is_used) {
        setCouponStatus({ type: "error", message: "This coupon has already been used" });
        setCouponApplied(false);
      } else {
        // Check phone number if applicable
        const couponPhone = data.phone_number ? data.phone_number.replace(/\D/g, "").slice(-10) : "";
        if (couponPhone && couponPhone !== cleanPhone) {
          setCouponStatus({ type: "error", message: "This coupon is not valid for your phone number" });
          setCouponApplied(false);
        } else {
          setCoupon({
            id: data.id,
            coupon_code: data.coupon_code,
            discount_percentage: data.discount_percentage || data.discount_p || 0,
            discount_amount: data.discount_amount || 0,
            source: "MANUAL_ENTRY"
          });
          const discountPct = data.discount_percentage || data.discount_p || 0;
          setCouponDiscount(discountPct);
          setCouponApplied(true);
          const msg = data.discount_amount && data.discount_amount > 0
            ? `Coupon applied! ₹${data.discount_amount} off`
            : `Coupon applied! ${discountPct}% off`;
          setCouponStatus({ type: "success", message: msg });
        }
      }
    } catch (err) {
      console.error("Coupon verification error:", err);
      setCouponStatus({ type: "error", message: "Error verifying coupon" });
    } finally {
      setIsVerifyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setCouponDiscount(0);
    setCouponApplied(false);
    setCoupon(null);
    setManualCouponCode("");
    setCouponStatus({ type: '', message: '' });
  };

  /* ================= TOTALS ================= */

  const totalSavings = useMemo(
    () => totalOriginalPrice - totalPrice,
    [totalOriginalPrice, totalPrice]
  );

  const totalDuration = useMemo(
    () =>
      formatMinutes(
        checkoutServices.reduce((sum, s) => {
          const qty = s.quantity || 1;
          return sum + (parseDurationToMinutes(s.duration) * qty);
        }, 0)
      ),
    [checkoutServices]
  );

  const totalTax = useMemo(
    () => checkoutServices.reduce((sum, s) => {
      const qty = s.quantity || 1;
      const servicePrice = parsePrice(s.price);
      // Parse tax_percent - handle text type with "%" symbol
      const taxPercentStr = String(s.tax_percent ?? '0').replace(/%/g, '').trim();
      const taxPercent = Number(taxPercentStr) || 0;
      return sum + ((servicePrice * taxPercent) / 100) * qty;
    }, 0),
    [checkoutServices]
  );

  const grandTotal = useMemo(() => {
    const baseTotal = totalPrice + totalTax;
    let finalTotal = baseTotal;

    // 1. Apply Coupon Discount (Percentage or Fixed)
    if (couponApplied && coupon) {
      if (coupon.discount_amount && coupon.discount_amount > 0) {
        // Fixed amount discount
        finalTotal = Math.max(0, baseTotal - coupon.discount_amount);
      } else if (couponDiscount > 0) {
        // Percentage discount calculated on totalOriginalPrice if present
        const baseForDiscount = totalOriginalPrice > 0 ? totalOriginalPrice : totalPrice;
        const discountAmount = (baseForDiscount * couponDiscount) / 100;
        finalTotal = Math.max(0, baseForDiscount - discountAmount + totalTax);
      }
    }

    // 2. Apply Wallet Discount (Flat Amount)
    if (useWallet && walletBalance > 0) {
      // Don't let discount exceed the total price
      const deduction = Math.min(finalTotal, walletBalance);
      finalTotal = finalTotal - deduction;
    }

    return finalTotal;
  }, [totalPrice, totalOriginalPrice, totalTax, couponApplied, couponDiscount, useWallet, walletBalance, coupon]);

  const walletDeductionAmount = useMemo(() => {
    if (!useWallet || walletBalance <= 0) return 0;
    const baseTotal = totalPrice + totalTax;
    let finalTotal = baseTotal;

    if (couponApplied && coupon) {
      if (coupon.discount_amount && coupon.discount_amount > 0) {
        finalTotal = Math.max(0, baseTotal - coupon.discount_amount);
      } else if (couponDiscount > 0) {
        const baseForDiscount = totalOriginalPrice > 0 ? totalOriginalPrice : totalPrice;
        const discountAmount = (baseForDiscount * couponDiscount) / 100;
        finalTotal = Math.max(0, baseForDiscount - discountAmount + totalTax);
      }
    }
    return Math.min(finalTotal, walletBalance);
  }, [totalPrice, totalOriginalPrice, totalTax, couponApplied, couponDiscount, useWallet, walletBalance, coupon]);


  /* ================= PAYMENT ================= */

  const handlePlaceOrder = async () => {
    if (!userId) {
      setAlertConfig({ title: 'Error', message: 'Missing user session', type: 'error' });
      setShowAlertModal(true);
      return;
    }

    if (isProcessing) return;

    const userPhone = profile?.phone || "";

    if (!userPhone.trim()) {
      setAlertConfig({
        title: 'Missing Phone Number',
        message: 'Please enter your phone number to proceed.',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    // ✅ Validate Phone Number (Must be exactly 10 digits)
    const phoneDigits = userPhone.replace(/\D/g, ''); // Remove non-digits
    if (phoneDigits.length !== 10) {
      setAlertConfig({
        title: 'Invalid Phone Number',
        message: 'Phone number must be exactly 10 digits.',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    // ✅ Validate Address
    if (!manualAddress.trim() || !pincode.trim()) {
      setAlertConfig({
        title: 'Missing Address',
        message: 'Please enter your full address and pincode.',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    if (pincode.trim().length !== 6) {
      setAlertConfig({
        title: 'Invalid Pincode',
        message: 'Please enter a valid 6-digit pincode.',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    // ✅ Validate Checkboxes
    if (!acceptedPolicies || !acceptedTerms) {
      setAlertConfig({
        title: 'Agreement Required',
        message: 'Please accept both User Policies and Terms & Conditions to proceed with payment.',
        type: 'info'
      });
      setShowAlertModal(true);
      return;
    }

    // ✅ Block payment if pincode not serviceable
    if (!isPincodeServiceable) {
      setAlertConfig({
        title: 'Service Not Available',
        message: 'Services will be available soon in your area.',
        type: 'info'
      });
      setShowAlertModal(true);
      return;
    }

    setIsProcessing(true);

    const fullAddress = `${manualAddress.trim()} - ${pincode.trim()}`;

    // ✅ Auto-save profile
    supabase
      .from("profile")
      .update({
        // full_name: profile.full_name, // Don't overwrite profile name with booking name
        // phone: profile.phone,         // Don't overwrite profile phone with booking phone
        address: fullAddress,
        pincode: pincode,
      })
      .eq("id", userId)
      .then(({ error }) => {
        if (error) console.log("Failed to auto-save profile", error);
      });

    const [datePart, timePart] = bookingDateText.split(" at ");

    let finalLat = bookingLatitude;
    let finalLng = bookingLongitude;

    // ✅ Silent Geocoding: If coordinates are missing (manual entry), try to geocode the address
    if (!finalLat || !finalLng) {
      try {
        console.log("📍 Missing coordinates. Attempting silent geocode for:", fullAddress);
        const geoResults = await Location.geocodeAsync(fullAddress);
        if (geoResults && geoResults.length > 0) {
          finalLat = geoResults[0].latitude;
          finalLng = geoResults[0].longitude;
          console.log("✅ Silent geocode success:", finalLat, finalLng);
          // Also update state so it's consistent
          setBookingLatitude(finalLat);
          setBookingLongitude(finalLng);
        }
      } catch (geoErr) {
        console.log("⚠️ Silent geocoding failed", geoErr);
      }
    }

    try {
      /* ================= 1️⃣ CREATE BOOKING (PENDING) ================= */

      let promotionalBannerId = null;
      if (couponApplied && coupon && coupon.source === "PROMOTIONAL_BANNER") {
        const claimed = await getClaimedOffer();
        if (claimed && claimed.bannerId) {
          promotionalBannerId = claimed.bannerId;
        }
      }

      const { data: bookingData, error: insertError } = await supabase
        .from("bookings")
        .insert([
          {
            user_id: userId,
            customer_name: profile?.full_name || "Valued Customer",
            email: invoiceEmail.trim(),
            phone_number: profile?.phone || "",
            full_address: fullAddress,
            latitude: finalLat,
            longitude: finalLng,
            services: checkoutServices,
            booking_date: datePart,
            booking_time: timePart,
            booking_schedule_at: `${datePart} ${timePart} +05:30`,
            total_amount: Number(grandTotal.toFixed(2)),
            payment_status: "pending",
            payment_method: "razorpay",

            // ✅🔥 ADD THIS LINE (IMPORTANT)
            platform: Platform.OS === "ios" ? "ios" : "android",

            coupon_code: couponApplied && coupon ? coupon.coupon_code : null,
            coupon_discount_percentage: couponApplied && coupon ? couponDiscount : 0,
            coupon_discount_amount: couponApplied && coupon
              ? (coupon.discount_amount && coupon.discount_amount > 0
                ? coupon.discount_amount
                : Number((((totalOriginalPrice > 0 ? totalOriginalPrice : totalPrice) * couponDiscount) / 100).toFixed(2)))
              : 0,
            
            promotional_banner_id: promotionalBannerId,
          }
        ])
        .select("id")
        .single();

      if (insertError || !bookingData) {
        throw new Error(insertError?.message || "Failed to create booking");
      }

      const bookingId = bookingData.id;
      console.log("✅ Booking created with ID:", bookingId);

      /* ================= 2️⃣ PROCESS PAYMENT ================= */

      const fullName = profile?.full_name || "Valued Customer";
      const [firstName, ...rest] = fullName.split(" ");
      const lastName = rest.join(" ");

      let payment;

      // ✅ TEST MODE BYPASS
      if (fullName.toUpperCase() === "TEST USER") {
        console.log("🛠️ TEST MODE: Bypassing real payment...");
        payment = {
          success: true,
          paymentId: "test_pay_" + Date.now(),
          orderId: "test_ord_" + Date.now(),
          signature: "test_sig_123"
        };
      } else {
        payment = await processPayment(Number(grandTotal.toFixed(2)), {
          firstName,
          lastName,
          email: invoiceEmail,
          phone: userPhone,
          address: fullAddress,
          city: "", // Consolidated into fullAddress
          region: "",
          zip: pincode,
        }, bookingId);
      }

      if (!payment?.success) {
        // ✅ Update booking to "failed" status
        await supabase
          .from("bookings")
          .update({ payment_status: "failed", work_status: "PAYMENT FAILED" })
          .eq("id", bookingId);

        setIsProcessing(false);
        setAlertConfig({ title: 'Payment Failed', message: "We couldn't process your payment at this time. Please try again later.", type: 'error' });
        setShowAlertModal(true);
        return;
      }

      /* ================= 3️⃣ SUCCESS ================= */
      // Note: verify-payment edge function already updates payment_status to "paid"
      // This is a client-side backup update in case the edge function had issues

      await supabase
        .from("bookings")
        .update({
          payment_status: "paid",
          razorpay_payment_id: payment.paymentId,
          razorpay_order_id: payment.orderId,
          razorpay_signature: payment.signature,
          payment_verified: true,
        })
        .eq("id", bookingId);

      // ✅ Mark coupon as used (if applied)
      if (couponApplied && coupon && (coupon.source === "MANUAL_COUPON" || coupon.source === "MANUAL_ENTRY")) {
        await supabase
          .from("coupons")
          .update({ is_used: true })
          .eq("id", coupon.id);
        console.log("✅ Coupon marked as used:", coupon.coupon_code);
      }

      // ✅ Deduct from Wallet (if applied)
      if (useWallet && walletBalance > 0) {
        const deduction = Math.min(totalPrice + totalTax, walletBalance);
        const { error: walletError } = await supabase
          .from("wallet")
          .update({ balance: walletBalance - deduction })
          .eq("user_id", userId);

        if (!walletError) {
          // Record transaction using your specific table structure
          await supabase.from("wallet_transactions").insert({
            user_id: userId,
            amount: -deduction,
            transaction_type: 'booking_payment',
            description: `Discount applied to booking #${bookingId}`
          });
        }
        console.log("✅ Wallet balance updated after discount");
      }

      // Referral reward logic moved to database trigger (on COMPLETED status)


      // ✅ Send Booking Confirmation Email
      try {
        await invokeFunction("send-booking-confirmation", {
          body: { booking_id: bookingId },
        });
        console.log("✅ Booking confirmation email sent");
      } catch (emailError) {
        console.error("Email sending failed (non-critical):", emailError);
        // Don't fail the booking if email fails
      }

      // ✅ Send WhatsApp Payment Confirmation
      try {
        await invokeFunction("send-payment-confirmation", {
          body: {
            customer_phone: profile?.phone || "",
            customer_name: profile?.full_name || "Valued Customer",
            amount_paid: String(grandTotal.toFixed(2)),
            service_name: checkoutServices[0]?.title || 'Service'
          },
        });
        console.log("✅ WhatsApp payment confirmation sent");
      } catch (waError) {
        console.error("WhatsApp sending failed (non-critical):", waError);
      }

      // ✅ Send WhatsApp Booking Confirmation
      try {
        await invokeFunction("send-booking-confirmation-whatsapp", {
          body: {
            customer_phone: profile?.phone || "",
            customer_name: profile?.full_name || "Valued Customer",
            service_name: checkoutServices[0]?.title || 'Service',
            booking_date: bookingDateText || 'Your scheduled date'
          },
        });
        console.log("✅ WhatsApp booking confirmation sent");
      } catch (waBookingError) {
        console.error("WhatsApp booking sending failed (non-critical):", waBookingError);
      }

      // Clear cart & session-claimed offer
      await supabase.from("cart").delete().eq("user_id", userId);
      await clearClaimedOffer();

      setIsProcessing(false);

      // ✅ SHOW SUCCESS MODAL + SMALL VIBRATION
      setShowSuccessModal(true);
      Vibration.vibrate(80);

      setTimeout(() => {
        setShowSuccessModal(false);
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "HomeDrawer",
              params: {
                screen: "AuthenticatedScreens",
                params: {
                  screen: "MainTabs",
                  params: {
                    screen: "MyBookingsTab",
                  },
                },
              },
            },
          ],
        });
      }, 2500);

    } catch (err: any) {
      console.error("❌ Order error:", err);
      setIsProcessing(false);
      setAlertConfig({
        title: 'Error',
        message: err?.message || 'Something went wrong. Please try again.',
        type: 'error'
      });
      setShowAlertModal(true);
    }
  };

  if (!profile && !loadingProfile) return null;

  /* ================= UI ================= */

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header />

      <View style={[styles.headerContainer, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t("checkout.title")}</Text>
          <TouchableOpacity
            onPress={() => {
              const phoneNumber = "tel:7617618567";
              Linking.canOpenURL(phoneNumber).then(supported => {
                if (supported) Linking.openURL(phoneNumber);
              });
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: theme.border,
              gap: 4,
            }}
          >
            <Ionicons name="help-circle-outline" size={20} color={theme.primary} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.primary }}>Help</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={[styles.container, bottomNavPadding]}
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
          {/* ORDER SUMMARY */}
          <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("checkout.orderSummary")}</Text>
            </View>

            {checkoutServices.map((s: SelectedService) => (
              <View key={s.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceTitle, { color: theme.text }]}>
                    {s.title}
                    {s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : ""}
                  </Text>
                  <Text style={[styles.muted, { color: theme.textLight }]}>{s.duration}</Text>
                </View>

                {/* ✅ Pricing with discount - Calculate total based on quantity */}
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.price, { color: theme.text }]}>
                    ₹{(parseFloat(s.price.replace(/[^\d]/g, "")) * (s.quantity || 1)).toLocaleString("en-IN")}
                  </Text>
                  {(s.discount_label || (s.discount_percent && Number(s.discount_percent) > 0)) ? (
                    <Text style={{ fontSize: 10, color: "#1E7E34", fontWeight: "700" }}>
                      {s.discount_label || `${s.discount_percent}% off`}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Text style={[styles.muted, { color: theme.textLight }]}>{t("checkout.totalDuration")}: {totalDuration}</Text>

            {/* 1. Original Total */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ color: theme.textLight, fontSize: 14 }}>{t("checkout.originalTotal") || "Original Total"}</Text>
              <Text style={{ color: theme.textLight, fontSize: 14, textDecorationLine: (totalOriginalPrice > totalPrice || couponApplied) ? "line-through" : "none" }}>
                ₹{(totalOriginalPrice > 0 ? totalOriginalPrice : totalPrice).toLocaleString("en-IN")}
              </Text>
            </View>

            {/* 2. Coupon Discount Row */}
            {couponApplied && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={{ fontSize: 14, color: "#065F46", fontWeight: "600" }}>
                  Coupon ({coupon?.coupon_code})
                </Text>
                <Text style={{ fontSize: 14, color: "#065F46", fontWeight: "600" }}>
                  -₹{calculatedCouponDiscountAmount.toLocaleString("en-IN")}{couponDiscount || coupon?.discount_percentage ? ` (${couponDiscount || coupon?.discount_percentage}% OFF)` : ""}
                </Text>
              </View>
            )}

            {/* 3. Subtotal */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>Subtotal</Text>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>
                ₹{effectiveSubtotal.toLocaleString("en-IN")}
              </Text>
            </View>

            {/* 4. You Save */}
            {totalEffectiveSavings > 0 ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, backgroundColor: "#ECFDF5", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6 }}>
                <Text style={{ color: "#047857", fontSize: 14, fontWeight: "700" }}>🎉 {t("checkout.youSave") || "You Save"}</Text>
                <Text style={{ color: "#047857", fontSize: 14, fontWeight: "700" }}>
                  ₹{totalEffectiveSavings.toLocaleString("en-IN")}
                </Text>
              </View>
            ) : null}

            {/* 5. Tax */}
            {totalTax > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={{ fontSize: 14, color: theme.textLight }}>Tax</Text>
                <Text style={{ fontSize: 14, color: theme.textLight }}>₹{parseFloat(totalTax.toFixed(2)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}

            {/* Wallet Discount Row */}
            {useWallet && walletDeductionAmount > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={{ fontSize: 14, color: "#065F46", fontWeight: "600" }}>
                  Wallet Applied
                </Text>
                <Text style={{ fontSize: 14, color: "#065F46", fontWeight: "600" }}>
                  -₹{parseFloat(walletDeductionAmount.toFixed(2)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            {/* 6. Amount to Pay */}
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: theme.text }]}>Amount to Pay</Text>
              <Text style={styles.totalValue}>₹{parseFloat(grandTotal.toFixed(2)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
          </View>

          {/* ✅ COUPON SECTION */}
          <View style={styles.couponCard}>
            <Text style={styles.couponTitle}>Have a coupon code?</Text>

            {couponApplied && coupon ? (
              <View style={styles.couponRow}>
                <View style={styles.couponAppliedBadge}>
                  <Text style={styles.couponAppliedText}>
                    ✅ {coupon.coupon_code} applied! ({coupon.discount_amount && coupon.discount_amount > 0 ? `₹${coupon.discount_amount} off` : `${coupon.discount_percentage}% off`})
                  </Text>
                </View>
                <Pressable onPress={removeCoupon}>
                  <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 14 }}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <View style={styles.couponRow}>
                  <View style={[styles.couponInputBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <TextInput
                      style={[styles.couponInput, { color: theme.text }]}
                      value={manualCouponCode}
                      onChangeText={(text) => setManualCouponCode(text.toUpperCase())}
                      placeholder="ENTER CODE"
                      placeholderTextColor={theme.textLight}
                      autoCapitalize="characters"
                    />
                  </View>
                  <Pressable
                    style={[styles.couponApplyBtn, (!manualCouponCode.trim() || isVerifyingCoupon) && { opacity: 0.5 }]}
                    onPress={handleApplyManualCoupon}
                    disabled={!manualCouponCode.trim() || isVerifyingCoupon}
                  >
                    {isVerifyingCoupon ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.couponApplyBtnText}>Apply</Text>
                    )}
                  </Pressable>
                </View>

                {/* suggested coupon if auto-detected */}
                {coupon && !couponApplied && (
                  <Pressable
                    style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={applyCoupon}
                  >
                    <Text style={{ fontSize: 12, color: theme.textLight }}>🎉 Suggestion:</Text>
                    <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '700', textDecorationLine: 'underline' }}>
                      Apply {coupon.coupon_code} ({coupon.discount_amount && coupon.discount_amount > 0 ? `₹${coupon.discount_amount} off` : `${coupon.discount_percentage}% off`})
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {couponStatus.message ? (
              <Text style={[styles.couponSavingText, { color: couponStatus.type === 'error' ? '#EF4444' : '#065F46' }]}>
                {couponStatus.message}
              </Text>
            ) : couponApplied && coupon ? (
              <Text style={styles.couponSavingText}>
                You save ₹{coupon.discount_amount && coupon.discount_amount > 0
                  ? coupon.discount_amount
                  : (((totalOriginalPrice > 0 ? totalOriginalPrice : totalPrice) * (coupon.discount_percentage || 0)) / 100).toFixed(2)} with this coupon!
              </Text>
            ) : null}
          </View>

          {/* WALLET CREDIT */}
          {walletBalance > 0 && (
            <View style={[styles.walletCard, { backgroundColor: useWallet ? "#FFFBEB" : "#F8FAFC", borderColor: useWallet ? COLORS.saffron : "#E2E8F0" }]}>
              <View style={styles.walletHeader}>
                <View style={styles.walletInfo}>
                  <View style={[styles.walletIconContainer, { backgroundColor: useWallet ? "#FEF3C7" : "#EDF2F7" }]}>
                    <Ionicons name="wallet-outline" size={20} color={useWallet ? "#92400E" : "#4A5568"} />
                  </View>
                  <View>
                    <Text style={[styles.walletTitle, { color: useWallet ? "#92400E" : "#2D3748" }]}>Discount Wallet</Text>
                    <Text style={[styles.walletBalance, { color: useWallet ? "#B45309" : "#718096" }]}>₹{walletBalance} available</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setUseWallet(!useWallet)}
                  style={[styles.walletToggle, { backgroundColor: useWallet ? COLORS.saffron : "#E2E8F0" }]}
                >
                  <View style={[styles.toggleCircle, { transform: [{ translateX: useWallet ? 18 : 2 }] }]} />
                </TouchableOpacity>
              </View>
              {useWallet && (
                <View style={styles.walletAppliedBadge}>
                  <Text style={styles.walletAppliedText}>- ₹{walletDeductionAmount.toFixed(2)} applied from wallet</Text>
                </View>
              )}
            </View>
          )}

          {/* ADDRESS */}
          <Text style={[styles.sectionHeading, { color: theme.text }]}>{t("checkout.serviceAddress")}</Text>

          <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
            
            {/* ✅ Customer Details */}
            <View style={{ marginBottom: 16, paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={{ fontSize: 12, color: theme.textLight, marginBottom: 4 }}>Name</Text>
              <Text style={{ fontSize: 16, color: theme.text, fontWeight: '500', marginBottom: 12 }}>{profile?.full_name || "N/A"}</Text>
              
              <Text style={{ fontSize: 12, color: theme.textLight, marginBottom: 4 }}>Phone Number</Text>
              <Text style={{ fontSize: 16, color: theme.text, fontWeight: '500', marginBottom: 12 }}>{profile?.phone || "N/A"}</Text>

              <Text style={{ fontSize: 12, color: theme.textLight, marginBottom: 4 }}>Email for Invoice</Text>
              <TextInput
                style={{
                  fontSize: 16,
                  color: theme.text,
                  fontWeight: '500',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 8,
                  backgroundColor: theme.surfaceVariant,
                  marginBottom: 4,
                }}
                value={invoiceEmail}
                onChangeText={setInvoiceEmail}
                placeholder="Where should we send your receipt?"
                placeholderTextColor={theme.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border, marginHorizontal: 16 }]} />

            {/* Address Box */}
            <View style={[styles.addressSection, { backgroundColor: theme.background, borderColor: theme.border, borderTopWidth: 0 }]}>
              {/* ✅ SELECTED ADDRESS CARD */}
              {isAddressSummaryMode && hasUsedLocationFetch ? (
                <View style={[styles.summaryCard, { backgroundColor: theme.surfaceVariant }]}>
                  <View style={styles.summaryContent}>
                    <Pressable
                      style={[styles.locationIconCircle, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={handleViewOnMap}
                    >
                      <Ionicons name="location" size={20} color={theme.text} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.summaryTitle, { color: theme.textLight }]}>Selected Location</Text>
                      <Text style={[styles.summaryText, { color: theme.text }]}>
                        {`${manualAddress}${pincode ? " - " + pincode : ""}`}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.editButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={() => setIsAddressSummaryMode(false)}
                    >
                      <Ionicons name="create-outline" size={18} color={theme.text} />
                      <Text style={[styles.editButtonText, { color: theme.text }]}>Edit</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ padding: 16 }}>
                  <Text style={[styles.label, { color: theme.text }]}>{t("checkout.fullAddress")}</Text>
                  <TextInput
                    style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12, backgroundColor: theme.surfaceVariant, borderColor: theme.border, color: theme.text }]}
                    value={manualAddress}
                    onChangeText={setManualAddress}
                    placeholder="Plot No, Flat No, Building Name, Area, City"
                    placeholderTextColor={theme.textLight}
                    multiline
                    numberOfLines={4}
                  />

                  <Text style={[styles.label, { color: theme.text }]}>{t("checkout.pincode")}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surfaceVariant, borderColor: theme.border, color: theme.text }]}
                    value={pincode}
                    onChangeText={(text) => {
                      const onlyDigits = text.replace(/\D/g, "");
                      setPincode(onlyDigits);
                    }}
                    keyboardType="numeric"
                    maxLength={6}
                    placeholder="500090"
                    placeholderTextColor={theme.textLight}
                  />

                  {hasUsedLocationFetch && (
                    <Pressable
                      style={styles.doneButton}
                      onPress={async () => {
                        setIsAddressSummaryMode(true);
                        handleManualGeocode(`${manualAddress}, ${pincode}`);
                      }}
                    >
                      <Ionicons name="checkmark-done" size={18} color="#fff" />
                      <Text style={styles.doneButtonText}>Done Editing</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {/* ✅ FULL WIDTH PINCODE STATUS BADGE */}
            {pincode.length === 6 && (
              <View
                style={[
                  styles.serviceStatusBox,
                  checkingPincode
                    ? styles.serviceCheckingBox
                    : isPincodeServiceable
                      ? styles.serviceAvailableBox
                      : styles.serviceUnavailableBox,
                  { marginTop: 12 }
                ]}
              >
                <Ionicons
                  name={
                    checkingPincode
                      ? "time-outline"
                      : isPincodeServiceable
                        ? "checkmark-circle"
                        : "close-circle"
                  }
                  size={18}
                  color={
                    checkingPincode
                      ? "#64748b"
                      : isPincodeServiceable
                        ? "#10B981"
                        : "#EF4444"
                  }
                />

                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceStatusText}>
                    {checkingPincode
                      ? t("checkout.checking")
                      : isPincodeServiceable
                        ? t("checkout.serviceAvailable")
                        : t("checkout.serviceNotAvailable")}
                  </Text>

                  {!checkingPincode && (
                    <Text style={styles.serviceSubText} numberOfLines={1}>
                      {isPincodeServiceable
                        ? "You can continue with booking."
                        : "We will be available soon in your area."}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* CHECKBOXES */}
          <View style={styles.checkboxContainer}>
            <Pressable style={styles.checkboxRow} onPress={() => setAcceptedPolicies(!acceptedPolicies)}>
              <View style={[styles.checkbox, acceptedPolicies && { backgroundColor: theme.primary, borderColor: theme.primary }, !acceptedPolicies && { borderColor: theme.primary, backgroundColor: theme.background }]}>
                {acceptedPolicies && <Ionicons name="checkmark" size={16} color={theme.background} />}
              </View>
              <Text style={[styles.checkboxLabel, { flex: 0, color: theme.text }]}>
                {t("checkout.acceptPolicies")}{" "}
                <Text
                  style={[styles.linkText, { color: theme.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowPoliciesModal(true);
                  }}
                >
                  {t("checkout.policies")}
                </Text>
              </Text>
            </Pressable>

            <Pressable style={styles.checkboxRow} onPress={() => setAcceptedTerms(!acceptedTerms)}>
              <View style={[styles.checkbox, acceptedTerms && { backgroundColor: theme.primary, borderColor: theme.primary }, !acceptedTerms && { borderColor: theme.primary, backgroundColor: theme.background }]}>
                {acceptedTerms && <Ionicons name="checkmark" size={16} color={theme.background} />}
              </View>
              <Text style={[styles.checkboxLabel, { flex: 0, color: theme.text }]}>
                {t("checkout.acceptTerms")}{" "}
                <Text
                  style={[styles.linkText, { color: theme.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowTermsModal(true);
                  }}
                >
                  {t("checkout.terms")}
                </Text>
              </Text>
            </Pressable>
          </View>


          {/* PAY BUTTON */}
          {(!manualAddress.trim() || !pincode.trim()) ? (
            <View style={{ padding: 16, alignItems: 'center', opacity: 0.7 }}>
              <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
                Please provide a valid service address to place your order.
              </Text>
            </View>
          ) : (
            <Pressable
              style={[
                styles.payBtn,
                { backgroundColor: theme.primary },
                (isProcessing ||
                  checkingPincode ||
                  !acceptedPolicies ||
                  !acceptedTerms ||
                  !isPincodeServiceable) &&
                styles.payBtnDisabled,
              ]}
              onPress={handlePlaceOrder}
              disabled={
                isProcessing ||
                checkingPincode ||
                !acceptedPolicies ||
                !acceptedTerms ||
                !isPincodeServiceable
              }
            >
              <Text style={[styles.payText, { color: theme.background }]}>
                {isProcessing
                  ? t("checkout.processing")
                  : checkingPincode
                    ? t("checkout.checking")
                    : !isPincodeServiceable && pincode.length === 6
                      ? t("checkout.serviceNotAvailable")
                      : t("checkout.placeOrder")}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Loading Overlay */}
      <LoadingOverlay visible={isProcessing} message="Processing your payment..." />

      {/* Policies Modal */}
      <Modal
        visible={showPoliciesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPoliciesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{t("checkout.policies")}</Text>
              <Pressable onPress={() => setShowPoliciesModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalHeading}>Privacy & Data Protection</Text>
              <Text style={[styles.modalText, { color: theme.textLight }]}>
                {policies?.user_policies
                  ? policies.user_policies.replace(/^- /gm, '• ')
                  : "Loading policies..."}
              </Text>
            </ScrollView>

            <Pressable style={[styles.modalCloseButton, { backgroundColor: theme.primary }]} onPress={() => setShowPoliciesModal(false)}>
              <Text style={[styles.modalCloseButtonText, { color: theme.background }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Terms Modal */}
      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        prefetchedTerms={policies?.terms_and_conditions}
      />

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successOverlay}>
          <AnimatedGradientBorder
            borderRadius={24}
            borderWidth={2}
            animationSpeed={3}
            style={{ width: "85%", maxWidth: 400 }}
          >
            <View style={[styles.successContent, { width: "100%", borderRadius: 24, margin: 0, backgroundColor: theme.background }]}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={80} color={theme.primary} />
              </View>

              <Text style={[styles.successTitle, { color: theme.text }]}>{t("checkout.bookingConfirmed")}</Text>
              <Text style={[styles.successMessage, { color: theme.textLight }]}>
                {t("notifications.bookingSuccessMessage")}
              </Text>

              <Text style={[styles.redirectText, { color: theme.primary }]}>{t("checkout.redirecting")}</Text>
            </View>
          </AnimatedGradientBorder>
        </View>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal
        visible={showAlertModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAlertModal(false)}
      >
        <View style={styles.alertOverlay}>
          <AnimatedGradientBorder
            borderRadius={20}
            borderWidth={2}
            animationSpeed={3}
            style={{ width: "100%", maxWidth: 360 }}
          >
            <View style={[styles.alertContent, { width: "100%", borderRadius: 20, margin: 0, backgroundColor: theme.background }]}>
              {/* Icon based on type */}
              <View style={styles.alertIconContainer}>
                <Ionicons
                  name={
                    alertConfig.type === 'error'
                      ? 'close-circle'
                      : alertConfig.type === 'warning'
                        ? 'alert-circle'
                        : 'information-circle'
                  }
                  size={64}
                  color={
                    alertConfig.type === 'error'
                      ? '#EF4444'
                      : alertConfig.type === 'warning'
                        ? '#F4C430'
                        : '#3B82F6'
                  }
                />
              </View>

              {/* Title and Message */}
              <Text style={[styles.alertTitle, { color: theme.text }]}>{alertConfig.title}</Text>
              <Text style={[styles.alertMessage, { color: theme.textLight }]}>{alertConfig.message}</Text>

              {/* OK Button */}
              <Pressable
                style={[
                  styles.alertButton,
                  { backgroundColor: theme.primary },
                  alertConfig.type === 'error' && styles.alertButtonError,
                  alertConfig.type === 'warning' && styles.alertButtonWarning,
                  alertConfig.type === 'info' && styles.alertButtonInfo,
                ]}
                onPress={() => setShowAlertModal(false)}
              >
                <Text style={styles.alertButtonText}>OK</Text>
              </Pressable>
            </View>
          </AnimatedGradientBorder>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
  },
  container: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 20,
    color: "#333",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  sectionHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  serviceTitle: {
    fontWeight: "600",
    fontSize: 15,
    color: "#1e293b",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 12,
  },
  muted: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 2,
  },
  price: {
    fontWeight: "700",
    fontSize: 15,
    color: "#1e293b",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.saffron,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#f8fafc",
    fontSize: 14,
    color: "#333",
  },
  rowInputs: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.saffron,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#fff",
  },
  secondaryBtnText: {
    color: COLORS.saffron,
    fontWeight: "600",
  },
  addressSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  summaryCard: {
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  summaryContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  locationIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryTitle: {
    fontSize: 12,
    // fontFamily: "Outfit-Medium", // Assuming Outfit-Medium is defined elsewhere or removed
    color: "#64748b",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  summaryText: {
    fontSize: 14,
    // fontFamily: "Outfit-Regular", // Assuming Outfit-Regular is defined elsewhere or removed
    color: "#1e293b",
    lineHeight: 20,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  editButtonText: {
    fontSize: 12,
    // fontFamily: "Outfit-Bold", // Assuming Outfit-Bold is defined elsewhere or removed
    color: "#1e293b",
  },
  doneButton: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 8,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  pincodeStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  pincodeStatusAvailable: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
    borderWidth: 1,
  },
  pincodeStatusUnavailable: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
    borderWidth: 1,
  },
  pincodeStatusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  useLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.saffron,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  useLocationButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.buttonText,
  },
  checkboxContainer: {
    marginTop: 20,
    gap: 12,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: COLORS.saffron,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: COLORS.saffron,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  linkText: {
    color: COLORS.saffron,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  payBtn: {
    backgroundColor: COLORS.saffron,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.buttonText,
  },

  /* ✅ PROFESSIONAL SERVICE STATUS BADGE (FULL WIDTH) */
  serviceStatusBox: {
    marginTop: 2,
    width: "100%",
    alignSelf: "stretch",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  serviceAvailableBox: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  serviceUnavailableBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  serviceCheckingBox: {
    backgroundColor: "#F1F5F9",
    borderColor: "#94A3B8",
  },
  serviceStatusText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  serviceSubText: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: "70%",
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.saffron,
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#475569",
    marginBottom: 12,
    textAlign: "justify",
  },
  modalCloseButton: {
    backgroundColor: COLORS.saffron,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.buttonText,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  successContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
  },
  redirectText: {
    fontSize: 14,
    color: COLORS.saffron,
    fontStyle: "italic",
  },

  // Custom Alert Modal Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
  },
  alertIconContainer: {
    marginBottom: 20,
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  alertMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  alertButton: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: COLORS.saffron,
  },
  alertButtonError: {
    backgroundColor: "#EF4444",
  },
  alertButtonWarning: {
    backgroundColor: "#F4C430",
  },
  alertButtonInfo: {
    backgroundColor: "#3B82F6",
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  couponCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FCD34D",
    borderStyle: "dashed" as any,
    padding: 16,
    marginBottom: 16,
  },
  couponTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#92400E",
    marginBottom: 10,
  },
  couponRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  couponCodeBox: {
    flex: 1,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  couponCode: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: "#78350F",
    letterSpacing: 2,
  },
  couponInputBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 45,
    justifyContent: "center",
  },
  couponInput: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
  couponApplyBtn: {
    backgroundColor: "#F4C430",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  couponApplyBtnText: {
    color: "#fff",
    fontWeight: "700" as const,
    fontSize: 14,
  },
  couponAppliedBadge: {
    flex: 1,
    backgroundColor: "#D1FAE5",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  couponAppliedText: {
    color: "#065F46",
    fontWeight: "700" as const,
    fontSize: 13,
  },
  couponSavingText: {
    marginTop: 8,
    fontSize: 12,
    color: "#065F46",
    fontWeight: "600" as const,
  },
  walletCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
    marginTop: 10,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  walletInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  walletTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  walletBalance: {
    fontSize: 13,
    fontWeight: "500",
  },
  walletToggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  walletAppliedBadge: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(251, 191, 36, 0.2)",
  },
  walletAppliedText: {
    fontSize: 13,
    color: "#065F46",
    fontWeight: "700",
  },
});
