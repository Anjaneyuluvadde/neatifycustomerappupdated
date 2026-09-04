import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useFocusEffect, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedGradientBorder from "../components/AnimatedGradientBorder";
import Header from "../components/Header";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import {
  RootStackParamList,
  SelectedService,
} from "../navigation/AppNavigator";
import LocationService from "../services/LocationService";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

/* ================= ROUTE ================= */

type Props = {
  route: RouteProp<RootStackParamList, "Schedule">;
};

/* ================= ADD-ON TYPE ================= */

type AddOn = {
  id: string;
  title: string;
  duration: number;
  price: string; // text with ₹ symbol from db
  image?: string | null;
  service_type?: string;
  description?: string;
  sort_order?: number;
  original_price?: string | null; // text with ₹ symbol from db
  discount_percent?: number | null;
  work_includes?: string | null; // text (was text[], now text)
  work_not_included?: string | null; // text in db
  discount_label?: string | null;
  tax_percent?: number | null;
  max_quantity?: number | null; // max times this addon can be added (from db)
  is_active?: boolean; // only show addon if true
};

type Profile = {
  full_name: string;
  email?: string;
  phone: string;
  address?: string;
  pincode?: string;
};

type Policies = {
  user_policies: string;
  terms_and_conditions: string;
};

const formatDisplayPhone = (phone: string | undefined | null) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/**
 * Parse text that may be in PostgreSQL array format {"item1","item2"} or newline-separated text.
 */
const parseTextList = (text: string): string[] => {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
      .slice(1, -1)
      .split(/",\s*"/)
      .map((s) => s.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }
  return trimmed
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
};

/* ================= CONSTANTS ================= */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Fallback defaults (used if schedule_config table fetch fails)
const DEFAULT_YEARS = [2026, 2027, 2028];
const DEFAULT_TIMES = [
  "9:00 am",
  "9:30 am",
  "10:00 am",
  "10:30 am",
  "11:00 am",
  "11:30 am",
  "12:00 pm",
  "1:00 pm",
  "1:30 pm",
  "2:00 pm",
  "2:30 pm",
  "3:00 pm",
  "3:30 pm",
  "4:00 pm",
  "4:30 pm",
];

const today = new Date();

/* ================= HELPERS ================= */

const normalizeCategory = (catStr?: string) => {
  if (!catStr) return "";
  let c = String(catStr).toUpperCase().trim().replace(/_/g, " ");
  if (c.includes("BATHROOM")) return "BATHROOM";
  if (c.includes("KITCHEN UTENSIL") || c.includes("UTENSIL")) return "KITCHEN_UTENSIL_CLEANING";
  if (c.includes("KITCHEN")) return "KITCHEN";
  if (c.includes("DEEP CLEANING")) return "DEEP CLEANING";
  if (c.includes("BALCONY")) return "BALCONY CLEANING";
  if (c.includes("CLOTHES FOLDING") || c.includes("FOLDING")) return "CLOTHES_FOLDING";
  if (c.includes("CLOTHES IRONING") || c.includes("IRONING")) return "CLOTHES_IRONING";
  if (c.includes("FLOOR MOPPING") || c.includes("MOPPING")) return "FLOOR_MOPPING";
  return c;
};

const parseDurationToMinutes = (duration?: any): number => {
  if (!duration) return 0;
  if (typeof duration === "number") return duration;

  const str = String(duration).trim().toLowerCase();
  if (/^\d+$/.test(str)) return Number(str);

  let total = 0;
  const hrMatch = str.match(/(\d+(?:\.\d+)?)\s*hr/);
  if (hrMatch) total += parseFloat(hrMatch[1]) * 60;

  let remaining = str;
  if (hrMatch) {
    remaining = str.replace(/.*hr[s]?/, "");
  }

  const minMatch = remaining.match(/(\d+)/);
  if (minMatch) total += Number(minMatch[1]);

  return Math.round(total);
};

const timeToMinutes = (timeStr?: string) => {
  if (!timeStr) return 0;
  const normalized = String(timeStr).toLowerCase().trim();
  const isPm = normalized.includes("pm");
  const timePart = normalized.replace(/[ap]m/g, "").trim();
  if (!timePart) return 0;

  let [h, m] = timePart.split(":").map(Number);
  m = m || 0;

  if (isPm && h !== 12) h += 12;
  if (!isPm && h === 12) h = 0;

  return h * 60 + m;
};

const isPastDate = (year: number, month: number, day: number) => {
  const d = new Date(year, month, day);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d < t;
};

const getCalendarMatrix = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const matrix: (number | null)[][] = Array.from({ length: 7 }, () => []);

  for (let i = 0; i < firstDay; i++) matrix[i].push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = (firstDay + day - 1) % 7;
    matrix[weekday].push(day);
  }

  const maxRows = Math.max(...matrix.map((c) => c.length));
  matrix.forEach((c) => {
    while (c.length < maxRows) c.push(null);
  });

  return matrix;
};

const isTimeSlotValid = (
  year: number,
  month: number,
  day: number | null,
  timeString: string,
  selectedServices: SelectedService[],
  serviceTimeRules: any[]
) => {
  if (day === null) return false;
  if (!timeString || typeof timeString !== "string") return false;

  const normalizedTime = timeString.toLowerCase().trim();
  const isPm = normalizedTime.includes("pm");
  const timePart = normalizedTime.replace(/[ap]m/g, "").trim();

  if (!timePart) return false;
  let [hours, minutes] = timePart.split(":").map(Number);
  minutes = minutes || 0;

  if (isPm && hours < 12) hours += 12;
  if (!isPm && hours === 12) hours = 0;

  const slotDate = new Date(year, month, day, hours, minutes);
  const now = new Date();
  const cutoff = new Date(now.getTime() + 90 * 60000); // Now + 90 mins

  // 1. Basic delay check (Now + 90 mins)
  if (slotDate <= cutoff) return false;

  // 2. Service-specific last booking time check
  if (selectedServices && selectedServices.length > 0) {
    const firstService = selectedServices[0];
    const selectedCategoryNorm = normalizeCategory(
      firstService?.service_type || (firstService as any)?.category || firstService?.title
    );
    const selectedServiceNames = selectedServices.map((s) => (s.title || "").toLowerCase().trim());
    const slotMinutesTotal = hours * 60 + minutes;

    if (serviceTimeRules && serviceTimeRules.length > 0) {
      const matchingRules = serviceTimeRules.filter((rule) => {
        const ruleCategoryNorm = normalizeCategory(rule.service_name || rule.service || rule.category);
        if (selectedCategoryNorm && ruleCategoryNorm && selectedCategoryNorm === ruleCategoryNorm) {
          return true;
        }
        const ruleServiceName = String(rule.service_name || rule.service || "").toLowerCase().trim();
        if (!ruleServiceName) return false;
        return selectedServiceNames.some((name) => name.includes(ruleServiceName) || ruleServiceName.includes(name));
      });

      if (matchingRules.length > 0) {
        let earliestLimitInMinutes: number | null = null;

        matchingRules.forEach((rule) => {
          const lbTimeRaw = rule.last_booking_time;
          if (!lbTimeRaw) return;

          const limitInMinutes = timeToMinutes(String(lbTimeRaw));
          if (limitInMinutes > 0) {
            if (earliestLimitInMinutes === null || limitInMinutes < earliestLimitInMinutes) {
              earliestLimitInMinutes = limitInMinutes;
            }
          }
        });

        if (earliestLimitInMinutes !== null) {
          if (slotMinutesTotal > earliestLimitInMinutes) {
            return false;
          }
        }
      }
    }
  }

  return true;
};

/* ================= PRICE HELPERS ================= */

const formatPrice = (value: any) => {
  if (value === null || value === undefined) return "";
  return value
    .toString()
    .replace(/^₹\s*/, "")
    .replace(/,/g, "");
};

const displayRupee = (value: any) => {
  const cleaned = formatPrice(value);
  if (!cleaned) return "";
  return `₹${Number(cleaned).toLocaleString("en-IN")}`;
};

/* ================= COMPONENT ================= */

type ScheduleScreenProps = {
  route: RouteProp<RootStackParamList, "Schedule">;
};

export default function ScheduleScreen({ route }: ScheduleScreenProps) {
  const navigation = useNavigation<any>();
  const { showAlert } = useNotification();
  const insets = useSafeAreaInsets();
  const bottomNavPadding = useBottomNavPadding();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();

  const offerBadgeText = (discount_percent: any, percentText?: any) => {
    if (percentText) return percentText;
    if (discount_percent && Number(discount_percent) > 0) {
      return `${discount_percent}% off`;
    }
    return t("serviceDetail.specialOffer");
  };

  const services = route.params?.services || [];

  const [selectedServices, setSelectedServices] =
    useState<SelectedService[]>(services);

  const [editServices, setEditServices] =
    useState<SelectedService[]>(services);

  useEffect(() => {
    // ❌ Removed applyClaimedOfferToSchedule that modifies service prices directly.
    // We now apply it as a coupon code automatically in CheckoutScreen.
  }, []);

  const [allServices, setAllServices] = useState<Service[]>([]);

  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());


  const [showAddService, setShowAddService] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Addons-related state
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const addonsTouchY = useRef(0);
  const [selectedAddonDetail, setSelectedAddonDetail] = useState<AddOn | null>(null);
  const [addons, setAddons] = useState<AddOn[]>([]);

  // Dynamic schedule config & capacity state from Supabase
  const [timeSlots, setTimeSlots] = useState<string[]>(DEFAULT_TIMES);
  const [timeSlotsConfig, setTimeSlotsConfig] = useState<any[]>([]);
  const [dateTimeSlotsConfig, setDateTimeSlotsConfig] = useState<Record<string, string[]>>({});
  const [rawDateTimeSlotsConfig, setRawDateTimeSlotsConfig] = useState<Record<string, any[]>>({});
  const [dateBookings, setDateBookings] = useState<any[]>([]);
  const [categoryStaffCount, setCategoryStaffCount] = useState<number>(1);
  const [availableYears, setAvailableYears] = useState<number[]>(DEFAULT_YEARS);
  const [serviceTimeRules, setServiceTimeRules] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Service Address & Profile State
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [manualAddress, setManualAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [bookingLatitude, setBookingLatitude] = useState<number | null>(null);
  const [bookingLongitude, setBookingLongitude] = useState<number | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [isAddressSummaryMode, setIsAddressSummaryMode] = useState(false);
  const [hasUsedLocationFetch, setHasUsedLocationFetch] = useState(false);

  // Pincode Verification State
  const [isPincodeServiceable, setIsPincodeServiceable] = useState<boolean>(false);
  const [checkingPincode, setCheckingPincode] = useState<boolean>(false);
  const [isPincodeInArea, setIsPincodeInArea] = useState<boolean>(false);
  const [isHubCapacityAvailable, setIsHubCapacityAvailable] = useState<boolean>(true);
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);

  // Policies State
  const [policies, setPolicies] = useState<Policies | null>(null);



  // Custom Alert Modal State
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'error' | 'info' | 'warning';
  }>({ title: '', message: '', type: 'error' });

  // Manual Geocode Helper
  const handleManualGeocode = async (addressToGeocode: string) => {
    if (!addressToGeocode || !addressToGeocode.trim()) return null;
    try {
      const geoResults = await Location.geocodeAsync(addressToGeocode);
      if (geoResults && geoResults.length > 0) {
        const { latitude, longitude } = geoResults[0];
        setBookingLatitude(latitude);
        setBookingLongitude(longitude);
        return { latitude, longitude };
      }
    } catch (err) {
      console.log("Geocoding failed for:", addressToGeocode, err);
    }
    return null;
  };

  // View on map helper
  const handleViewOnMap = async () => {
    let currentLat = bookingLatitude;
    let currentLng = bookingLongitude;

    if (!currentLat || !currentLng) {
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

  // Pincode Serviceability Check
  const checkPincodeServiceable = async (pin: string) => {
    console.log(`[SERVICEABILITY STEP 2] Pincode received: ${pin}`);
    const cleanedPin = pin.trim();

    if (cleanedPin.length !== 6) {
      setIsPincodeServiceable(false);
      setIsPincodeInArea(false);
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
        setIsPincodeInArea(false);
        return;
      }

      const available = Array.isArray(data) && data.length > 0;
      setIsPincodeServiceable(available);
      setIsPincodeInArea(available);

      console.log(`[SERVICEABILITY STEP 2] Matching rows: ${data ? data.length : 0}`);
      console.log(`[SERVICEABILITY STEP 2] Matching hub: ${available ? data[0].hub_name : 'null'}`);
      console.log(`[SERVICEABILITY STEP 2] Final: ${available ? 'AVAILABLE' : 'NOT_AVAILABLE'}`);

    } catch (err: any) {
      console.log(`[SERVICEABILITY STEP 2] Final: NOT_AVAILABLE`);
      setIsPincodeServiceable(false);
      setIsPincodeInArea(false);
    } finally {
      setCheckingPincode(false);
    }
  };

  useEffect(() => {
    checkPincodeServiceable(pincode);
  }, [pincode]);

  // Load Profile from Supabase
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
      console.error("Profile load error:", error);
      setLoadingProfile(false);
      return;
    }

    if (profileData) {
      const cleanedProfile = {
        ...profileData,
        phone: formatDisplayPhone(profileData.phone)
      };
      setProfile(cleanedProfile);

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
      setIsAddressSummaryMode(false);
    }
    setLoadingProfile(false);
  }, []);

  // Fetch Policies
  const fetchPolicies = useCallback(async () => {
    const { data, error } = await supabase
      .from("app_policies")
      .select("user_policies, terms_and_conditions")
      .limit(1)
      .maybeSingle();

    if (data) {
      setPolicies(data as Policies);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    fetchPolicies();
  }, [loadProfile, fetchPolicies]);

  useFocusEffect(
    useCallback(() => {
      Location.requestForegroundPermissionsAsync().catch((err) => {
        console.log("Location permission pre-request failed:", err);
      });
      return () => { };
    }, [])
  );

  // Fetch Current Location
  const fetchCurrentLocation = async () => {
    if (!userId) return;

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      setAlertConfig({
        title: 'Permission Denied',
        message: 'Location access is required to use this feature',
        type: 'warning'
      });
      setShowAlertModal(true);
      return;
    }

    setFetchingLocation(true);

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      setBookingLatitude(latitude);
      setBookingLongitude(longitude);

      try {
        const addressList = await Location.reverseGeocodeAsync({ latitude, longitude });

        if (addressList[0]) {
          const addr: any = addressList[0];
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
            setManualAddress(addr.street || addr.district || addr.subregion || "");
            if (addr.postalCode) setPincode(addr.postalCode);
            setIsAddressSummaryMode(false);
          }
        }
      } catch (geoErr) {
        console.log("Geocoding failed:", geoErr);
      }
    } catch (err) {
      console.error("Location fetch error:", err);
      setAlertConfig({
        title: 'Location Error',
        message: 'Could not fetch your location. Please try again or enter manually.',
        type: 'error'
      });
      setShowAlertModal(true);
    } finally {
      setFetchingLocation(false);
    }
  };

  const calendar = useMemo(() => getCalendarMatrix(year, month), [year, month]);

  const selectedDayName =
    selectedDate !== null
      ? FULL_DAYS[new Date(year, month, selectedDate).getDay()]
      : "";

  /* ================= FETCH SERVICES & ADDONS ================= */

  const fetchData = useCallback(async () => {
    // Fetch services
    const { data: servicesData } = await supabase
      .from("services")
      .select("*");
    if (servicesData) setAllServices(servicesData);

    // Fetch addons (only active ones)
    const { data: addonsData, error: addonsError } = await supabase
      .from("add_ons")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (addonsError) console.error("Error fetching addons:", addonsError);
    if (addonsData) setAddons(addonsData as AddOn[]);

    // Fetch schedule config (time_slots, years)
    const { data: configData, error: configError } = await supabase
      .from("schedule_config")
      .select("*");

    if (configError) {
      console.error("Error fetching schedule config:", configError);
      return;
    }

    if (configData) {
      configData.forEach((row: { config_key: string; config_value: any }) => {
        if (row.config_key === "time_slots" && Array.isArray(row.config_value)) {
          setTimeSlotsConfig(row.config_value);
          const normalized = row.config_value
            .map((slot: any) => {
              if (typeof slot === "string") return slot.trim();
              if (slot && typeof slot === "object" && slot.value) {
                const val = String(slot.value).trim();
                return val || null;
              }
              return null;
            })
            .filter(Boolean) as string[];
          setTimeSlots(normalized);
        }
        if (row.config_key === "date_time_slots" && typeof row.config_value === "object" && row.config_value !== null) {
          const rawObj = row.config_value as Record<string, any[]>;
          setRawDateTimeSlotsConfig(rawObj);
          const normalizedObj: Record<string, string[]> = {};

          Object.keys(rawObj).forEach((dateKey) => {
            const slots = rawObj[dateKey];
            if (Array.isArray(slots)) {
              normalizedObj[dateKey] = slots
                .map((slot: any) => {
                  if (typeof slot === "string") return slot.trim();
                  if (slot && typeof slot === "object" && slot.value) {
                    if (slot.active === false) return null;
                    return String(slot.value).trim();
                  }
                  return null;
                })
                .filter(Boolean) as string[];
            }
          });
          setDateTimeSlotsConfig(normalizedObj);
        }
        if (row.config_key === "years" && Array.isArray(row.config_value)) {
          const normalizedYears = row.config_value
            .map((y: any) => {
              if (typeof y === "number" || typeof y === "string") return Number(y);
              if (y && typeof y === "object" && y.value !== undefined) {
                if (y.active === false) return null;
                return Number(y.value);
              }
              return null;
            })
            .filter((y) => y !== null && !isNaN(y)) as number[];

          if (normalizedYears.length > 0) {
            setAvailableYears(normalizedYears);
          }
        }
        const key = (row as any).config_key || (row as any).config_keys || (row as any).config_id;
        if (key === "service_time_rules") {
          let rules = [];
          if (typeof row.config_value === "string") {
            try { rules = JSON.parse(row.config_value); } catch (e) { rules = []; }
          } else {
            rules = row.config_value;
          }
          const finalRules = Array.isArray(rules) ? rules : (rules ? [rules] : []);
          setServiceTimeRules(finalRules);
        }
      });
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  /* ================= HUB LOCATION & STAFF CAPACITY RESOLUTION ================= */
  const resolveHubFromLocation = useCallback(async (pinStr: string, addressStr: string = "") => {
    const cleanPin = String(pinStr || "").replace(/\D/g, "").slice(0, 6);

    // 1. Match by pincode in hub_locations table
    if (cleanPin.length === 6) {
      const { data: pinLocs, error } = await supabase
        .from("hub_locations")
        .select("hub_name, location_name, is_active")
        .eq("pincode", cleanPin);

      if (!error && pinLocs && pinLocs.length > 0) {
        if (addressStr) {
          const addrUpper = addressStr.toUpperCase();
          const specificMatch = pinLocs.find((hl: any) => {
            const locName = (hl.location_name || "").toUpperCase().trim();
            return locName && addrUpper.includes(locName);
          });
          if (specificMatch) {
            return { hubName: specificMatch.hub_name, isActive: specificMatch.is_active !== false };
          }
        }

        const activeMatch = pinLocs.find((hl: any) => hl.is_active !== false) || pinLocs[0];
        return { hubName: activeMatch.hub_name, isActive: activeMatch.is_active !== false };
      }
    }

    // 2. Fallback: Match by location_name or address substring in hub_locations table
    if (addressStr) {
      const addrUpper = addressStr.toUpperCase();
      const { data: allHubLocs } = await supabase
        .from("hub_locations")
        .select("hub_name, location_name, pincode, is_active");

      if (allHubLocs && allHubLocs.length > 0) {
        const match = allHubLocs.find((hl: any) => {
          const locName = (hl.location_name || "").toUpperCase().trim();
          return locName && addrUpper.includes(locName);
        });

        if (match) {
          return { hubName: match.hub_name, isActive: match.is_active !== false };
        }
      }
    }

    return { hubName: null, isActive: false };
  }, []);

  const fetchHubCategoryStaffCount = useCallback(async (hubName: string, servicesList: any[]) => {
    if (!hubName || !servicesList || servicesList.length === 0) return 0;

    const firstService = servicesList[0];
    let rawType = (firstService?.service_type || (firstService as any)?.category || firstService?.title || "").toUpperCase().trim();

    if (!rawType && firstService?.id) {
      try {
        const { data: sRow } = await supabase
          .from("services")
          .select("service_type, category")
          .eq("id", firstService.id)
          .maybeSingle();

        if (sRow) {
          rawType = (sRow.service_type || sRow.category || "").toUpperCase().trim();
        }
      } catch (e) {
        console.error("Error fetching service_type from DB:", e);
      }
    }

    if (!rawType) return 0;

    const normalizedTarget = normalizeCategory(rawType);
    const spaceType = rawType.replace(/_/g, " ").trim();
    const underscoreType = rawType.replace(/\s+/g, "_").trim();

    let mappedSpaceType = spaceType;
    if (mappedSpaceType === "KITCHEN CLEANING") mappedSpaceType = "KITCHEN";
    if (mappedSpaceType === "FULL HOME DEEP CLEANING") mappedSpaceType = "DEEP CLEANING";

    try {
      const { data: rows } = await supabase
        .from("hub_category_counts")
        .select("count, category, hub")
        .ilike("hub", hubName.trim());

      if (!rows || rows.length === 0) return 0;

      // Step 1: Canonical normalized category match (Strict exact category token match)
      let match = rows.find((r: any) => {
        const catNorm = normalizeCategory(r.category);
        return catNorm === normalizedTarget;
      });

      // Step 2: Strict raw string equality as secondary check
      if (!match) {
        match = rows.find((r: any) => {
          const cat = (r.category || "").toUpperCase().trim();
          return (
            cat === rawType ||
            cat === spaceType ||
            cat === underscoreType ||
            cat === mappedSpaceType
          );
        });
      }

      // Step 3: Strict word boundary fallback match (never matching substrings like KITCHEN inside KITCHEN_UTENSIL_CLEANING)
      if (!match) {
        match = rows.find((r: any) => {
          const cat = (r.category || "").toUpperCase().trim();
          const regex = new RegExp(`\\b${rawType.replace(/[^A-Z0-9]/g, "")}\\b`, "i");
          const cleanCat = cat.replace(/[^A-Z0-9]/g, "");
          return regex.test(cleanCat) && cleanCat === rawType.replace(/[^A-Z0-9]/g, "");
        });
      }

      if (match && match.count !== null && match.count !== undefined) {
        return Number(match.count);
      }
      return 0;
    } catch (e) {
      console.error("Error fetching hub category staff count:", e);
      return 0;
    }
  }, []);

  // Reset selectedTime when date, month, or year changes
  useEffect(() => {
    setSelectedTime(null);
  }, [selectedDate, month, year]);

  // Fetch active bookings for selected date
  useEffect(() => {
    const fetchDateBookings = async () => {
      if (selectedDate === null) {
        setDateBookings([]);
        return;
      }
      const dStr = String(selectedDate).padStart(2, "0");
      const mStr = String(month + 1).padStart(2, "0");
      const dateString = `${year}-${mStr}-${dStr}`;

      try {
        const { data: bData, error } = await supabase
          .from("bookings")
          .select("*");

        if (error) throw error;

        const activeBookings = (bData || []).filter((b: any) => {
          const ws = String(b.work_status || b.status || "").toUpperCase();
          const ps = String(b.payment_status || "").toUpperCase();
          if (ws === "CANCELLED" || ps === "FAILED") return false;

          const bDateStr = String(b.booking_date || "").trim();
          return bDateStr.includes(dateString) || bDateStr === dateString;
        });

        setDateBookings(activeBookings);
      } catch (err) {
        console.error("Error fetching date bookings:", err);
      }
    };

    fetchDateBookings();
  }, [selectedDate, month, year]);

  // Fetch hub-based staff capacity for selected service category & user location hub
  const [selectedHubName, setSelectedHubName] = useState<string>("");

  useEffect(() => {
    const updateCategoryServiceability = async () => {
      // We only resolve the hub name for contextual use if needed.
      // We explicitly DO NOT override isPincodeServiceable based on category capacity, 
      // ensuring availability is purely location-based.
      if (selectedServices && selectedServices.length > 0) {
        const { hubName } = await resolveHubFromLocation(pincode, manualAddress);
        setSelectedHubName(hubName || "");
      }
    };

    updateCategoryServiceability();
  }, [selectedServices, pincode, manualAddress, resolveHubFromLocation]);

  // Compute total service duration in minutes
  const totalDurationMinutes = useMemo(() => {
    if (!selectedServices || selectedServices.length === 0) return 45;
    const dur = selectedServices.reduce((acc, s) => {
      const singleDur = parseDurationToMinutes(s.duration) || 45;
      const qty = s.quantity || 1;
      return acc + singleDur * qty;
    }, 0);
    return dur > 0 ? dur : 45;
  }, [selectedServices]);

  const isDefaultSlotDisabled = useCallback(
    (timeStr: string) => {
      const config = timeSlotsConfig.find(
        (slot) =>
          (typeof slot === "string" && slot === timeStr) ||
          (typeof slot === "object" && slot && slot.value === timeStr)
      );
      return Boolean(config && typeof config === "object" && config.active === false);
    },
    [timeSlotsConfig]
  );

  /* ================= CAPACITY & TIME SLOT AVAILABILITY CHECK ================= */
  const isSlotDisabledByCapacity = useCallback(
    (timeStr: string) => {
      if (categoryStaffCount <= 0) return true;
      if (!dateBookings || dateBookings.length === 0) return false;

      const firstService = selectedServices[0];
      const selectedCategoryNorm = normalizeCategory(
        firstService?.service_type || (firstService as any)?.category || firstService?.title
      );

      const candidateStart = timeToMinutes(timeStr);
      const newDuration = totalDurationMinutes || 45;
      const candidateEnd = candidateStart + newDuration + 60; // candidate duration + 1 hr buffer

      // 1. Filter active dateBookings matching selected service category
      const categoryBookings = dateBookings.filter((b) => {
        let bServices: any[] = [];
        if (b.services) {
          try {
            bServices = typeof b.services === "string" ? JSON.parse(b.services) : b.services;
          } catch (e) { }
        }
        const bFirst = Array.isArray(bServices) && bServices.length > 0 ? bServices[0] : null;
        const rawCat =
          bFirst?.service_type ||
          bFirst?.category ||
          bFirst?.service_name ||
          bFirst?.title ||
          bFirst?.service ||
          bFirst?.name ||
          b.service_type ||
          b.category ||
          b.service_name ||
          b.title ||
          b.service ||
          "";

        const bCategoryNorm = normalizeCategory(rawCat);

        if (selectedCategoryNorm) {
          if (!bCategoryNorm || selectedCategoryNorm !== bCategoryNorm) {
            return false;
          }
        }
        return true;
      });

      if (categoryBookings.length === 0) return false;

      // 2. Build time intervals for existing category bookings [bStart, bEnd)
      const bookedWindows = categoryBookings.map((b) => {
        let bDur = parseDurationToMinutes(b.total_duration || b.service_duration);
        if (!bDur && b.services) {
          try {
            const parsed = typeof b.services === "string" ? JSON.parse(b.services) : b.services;
            if (Array.isArray(parsed) && parsed.length > 0) {
              bDur = parsed.reduce(
                (acc: number, s: any) => acc + (parseDurationToMinutes(s.duration) || 45) * (s.quantity || 1),
                0
              );
            }
          } catch (e) { }
        }
        bDur = bDur || 45;

        const bStart = timeToMinutes(b.booking_time);
        const bEnd = bStart + bDur + 60; // service duration + 1 hr buffer
        return { start: bStart, end: bEnd };
      });

      // 3. Check if candidate interval causes staff count to reach/exceed capacity
      for (let m = candidateStart; m < candidateEnd; m += 15) {
        let occupiedStaffAtM = 0;
        for (const w of bookedWindows) {
          if (m >= w.start && m < w.end) {
            occupiedStaffAtM++;
          }
        }
        if (occupiedStaffAtM >= categoryStaffCount) {
          return true; // Slot is DISABLED due to staff capacity
        }
      }

      return false; // Slot is ENABLED
    },
    [dateBookings, categoryStaffCount, totalDurationMinutes, selectedServices]
  );

  // Compute available time slots (all times default + custom sorted)
  const availableTimeSlots = useMemo(() => {
    let list = [...timeSlots];
    if (selectedDate !== null) {
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDate).padStart(2, "0")}`;
      const customTimes = rawDateTimeSlotsConfig[dateString] || [];
      const customStrings = customTimes
        .map((slot: any) => (typeof slot === "string" ? slot : slot?.value))
        .filter(Boolean);
      list = Array.from(new Set([...list, ...customStrings]));
    }
    return list.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  }, [selectedDate, month, year, rawDateTimeSlotsConfig, timeSlots]);

  const isSlotDisabled = useCallback(
    (timeStr: string) => {
      if (selectedDate === null) return true;

      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDate).padStart(2, "0")}`;
      const hasCustomTimes = !!rawDateTimeSlotsConfig[dateString];

      let isAdminDisabled = false;
      if (hasCustomTimes) {
        const customTimesForDate = rawDateTimeSlotsConfig[dateString] || [];
        const activeCustomTimes = customTimesForDate
          .filter((slot: any) => slot && (typeof slot === "string" || slot.active !== false))
          .map((slot: any) => (typeof slot === "string" ? slot : slot.value))
          .filter(Boolean);

        isAdminDisabled = !activeCustomTimes.includes(timeStr);
      } else {
        isAdminDisabled = isDefaultSlotDisabled(timeStr);
      }

      const isValidByServiceRules = isTimeSlotValid(
        year,
        month,
        selectedDate,
        timeStr,
        selectedServices,
        serviceTimeRules
      );

      const isCapacityDisabled = isSlotDisabledByCapacity(timeStr);

      return isAdminDisabled || !isValidByServiceRules || isCapacityDisabled;
    },
    [
      selectedDate,
      year,
      month,
      rawDateTimeSlotsConfig,
      isDefaultSlotDisabled,
      selectedServices,
      serviceTimeRules,
      isSlotDisabledByCapacity,
    ]
  );

  // ✅ Filter addons to match the main service's service_type (case-insensitive)
  const filteredAddons = useMemo(() => {
    // Try to get service_type directly from the selected service first
    let mainServiceType = editServices[0]?.service_type?.toUpperCase() || '';

    // Fallback to searching in allServices if type is missing
    if (!mainServiceType && editServices[0]?.id) {
      const mainService = allServices.find((s) => s.id === editServices[0].id);
      mainServiceType = mainService?.service_type?.toUpperCase() || '';
    }

    if (!mainServiceType) return [];

    return addons.filter(
      (addon) => addon.service_type?.toUpperCase() === mainServiceType
    );
  }, [addons, allServices, editServices]);

  /* ================= HELPERS ================= */

  const addAddonToCart = (addon: AddOn) => {
    // Check if already added
    const existingAddon = editServices.find((s) => s.id === addon.id);

    if (existingAddon) {
      // If already added, increment quantity (up to max_quantity)
      const maxQty = addons.find((a) => a.id === addon.id)?.max_quantity || 3;
      if ((existingAddon.quantity || 1) >= maxQty) {
        return;
      }

      setEditServices((prev) =>
        prev.map((s) =>
          s.id === addon.id
            ? { ...s, quantity: (s.quantity || 1) + 1 }
            : s
        )
      );
    } else {
      // Add new addon with quantity 1
      const newService: SelectedService = {
        id: addon.id,
        title: addon.title,
        duration: `${addon.duration} mins`,
        price: addon.price,
        original_price: addon.original_price,
        discount_percent: addon.discount_percent,
        discount_label: (addon as any)?.discount_label ?? null,
        tax_percent: (addon as any)?.tax_percent ?? null,
        image: addon.image ?? undefined,
        quantity: 1,
      };

      setEditServices((prev) => [...prev, newService]);
    }
  };

  const decrementAddon = (addonId: string) => {
    const existingAddon = editServices.find((s) => s.id === addonId);
    if (!existingAddon) return;

    if ((existingAddon.quantity || 1) <= 1) {
      // Remove the addon if quantity would go to 0
      setEditServices((prev) => prev.filter((s) => s.id !== addonId));
    } else {
      // Decrement quantity
      setEditServices((prev) =>
        prev.map((s) =>
          s.id === addonId
            ? { ...s, quantity: (s.quantity || 1) - 1 }
            : s
        )
      );
    }
  };

  /* ================= REUSABLE PRICE ROW ================= */

  const PriceRow = ({
    price,
    original_price,
    discount_percent,
    percentText,
    size = "normal",
  }: {
    price: any;
    original_price?: any;
    discount_percent?: any;
    percentText?: any;
    size?: "normal" | "small";
  }) => {
    const cleanPrice = formatPrice(price);
    const cleanOriginal = formatPrice(original_price);

    const hasOld =
      original_price !== null &&
      original_price !== undefined &&
      cleanOriginal &&
      Number(cleanOriginal) > Number(cleanPrice);

    const fontSize = size === "small" ? 16 : 22;
    const oldPriceSize = size === "small" ? 12 : 15;
    const badgePaddingV = size === "small" ? 4 : 8;

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: size === "small" ? 6 : 10,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {hasOld && (
          <Text
            style={{
              fontSize: oldPriceSize,
              color: theme.textLight,
              textDecorationLine: "line-through",
              textDecorationStyle: "solid",
              marginTop: 2,
            }}
          >
            {displayRupee(original_price)}
          </Text>
        )}

        <Text
          style={{
            fontSize: fontSize,
            fontWeight: "800",
            color: theme.text,
          }}
        >
          {displayRupee(price)}
        </Text>

        {(percentText || (discount_percent && discount_percent > 0)) && (
          <View
            style={{
              backgroundColor: isDark ? "rgba(22, 163, 74, 0.2)" : "#E9F7EF",
              paddingHorizontal: 10,
              paddingVertical: badgePaddingV,
              borderRadius: 22,
            }}
          >
            <Text
              style={{
                color: isDark ? "#4ade80" : "#1E7E34",
                fontWeight: "700",
                fontSize: size === "small" ? 11 : 14,
              }}
            >
              {percentText || offerBadgeText(discount_percent)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  /* ================= UI ================= */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <Header />
      <ScrollView
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
        {/* SERVICE DETAILS */}
        <View style={styles.headerRow}>
          <Text style={[styles.section, { color: theme.text, marginTop: 0 }]}>{t("schedule.serviceDetails")}</Text>
        </View>

        {selectedServices.map((s: SelectedService) => (
          <View key={s.id} style={[styles.serviceCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.bold, { color: theme.text }]}>
              {s.title}
              {s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : ""}
            </Text>

            {/* ✅ Pricing Display - Calculate total based on quantity */}
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>
                ₹{(parseFloat(s.price.replace(/[^\d]/g, "")) * (s.quantity || 1)).toLocaleString("en-IN")}
              </Text>

              {(s.discount_label || (s.discount_percent && Number(s.discount_percent) > 0)) ? (
                <View style={{ backgroundColor: "#E9F7EF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ color: "#1E7E34", fontWeight: "700", fontSize: 10 }}>
                    {s.discount_label || `${s.discount_percent}% off`}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.meta, { color: theme.textLight }]}>
              {selectedDate && selectedTime
                ? `${selectedDayName}, ${selectedDate} ${MONTHS[month]} ${year} at ${selectedTime}`
                : ""}
            </Text>
            <Text style={[styles.meta, { color: theme.textLight }]}>{s.duration}</Text>
          </View>
        ))}

        {/* SERVICE ADDRESS */}
        <Text style={[styles.sectionHeading, { color: theme.text, marginTop: 24, marginBottom: 12 }]}>{t("checkout.serviceAddress")}</Text>

        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {/* User Details */}
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.label, { color: theme.text }]}>{t("checkout.name")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceVariant, borderColor: theme.border, color: theme.text }]}
              value={profile?.full_name || ""}
              placeholderTextColor={theme.textLight}
              placeholder="Enter your name"
              onChangeText={(text) =>
                setProfile((prev) => (prev ? { ...prev, full_name: text } : { full_name: text, phone: "" }))
              }
            />

            <Text style={[styles.label, { color: theme.text }]}>{t("checkout.phone")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceVariant, borderColor: theme.border, color: theme.text }]}
              value={profile?.phone || ""}
              onChangeText={(text) => {
                const onlyDigits = text.replace(/\D/g, "");
                setProfile((prev) => (prev ? { ...prev, phone: onlyDigits } : { full_name: "", phone: onlyDigits }));
              }}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="10-digit mobile number"
              placeholderTextColor={theme.textLight}
            />
          </View>

          {/* Address Inputs */}
          <View style={{ marginTop: 8 }}>
            <View style={[styles.addressSection, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {/* SMART ADDRESS CARD */}
              {/* SMART ADDRESS CARD */}
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
                      {manualAddress || pincode ? `${manualAddress}${pincode ? " - " + pincode : ""}` : "No Address Provided"}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.editButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => setIsAddressSummaryMode(false)}
                  >
                    <Ionicons name="create-outline" size={18} color={theme.text} />
                    <Text style={[styles.editButtonText, { color: theme.text }]}>{manualAddress || pincode ? "Edit" : "Add"}</Text>
                  </Pressable>
                </View>
              </View>

              {/* ADDRESS EDIT MODAL POPUP */}
              <Modal visible={!isAddressSummaryMode} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setIsAddressSummaryMode(true)}>
                <View style={styles.pickerOverlay}>
                  <View style={[styles.pickerModal, { width: '90%', maxHeight: '80%', padding: 20, backgroundColor: theme.background }]}>
                    <Text style={[styles.addTitle, { color: theme.text, marginBottom: 15 }]}>{t("checkout.serviceAddress")}</Text>

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

                    <Text style={[styles.label, { color: theme.text, marginTop: 15 }]}>{t("checkout.pincode")}</Text>
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

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
                      <Pressable onPress={fetchCurrentLocation} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {fetchingLocation ? (
                          <ActivityIndicator size="small" color={theme.primary} />
                        ) : (
                          <Ionicons name="location" size={18} color={theme.primary} />
                        )}
                        <Text style={{ color: theme.primary, fontWeight: '600' }}>
                          {fetchingLocation ? "Fetching..." : t("checkout.useLocation")}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 25, gap: 12 }}>
                      {hasUsedLocationFetch && (
                        <Pressable
                          style={{ padding: 12, borderRadius: 8, justifyContent: 'center' }}
                          onPress={() => setIsAddressSummaryMode(true)}
                        >
                          <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={{ backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
                        onPress={async () => {
                          setIsAddressSummaryMode(true);
                          setHasUsedLocationFetch(true);
                          handleManualGeocode(`${manualAddress}, ${pincode}`);
                        }}
                      >
                        <Text style={{ color: '#000', fontWeight: '700' }}>Save Address</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Modal>
            </View>

            {/* PINCODE STATUS BADGE */}
            {pincode.length === 6 && (
              <Pressable
                disabled={checkingPincode || isPincodeServiceable || !isPincodeInArea}
                onPress={() => setShowEmergencyModal(true)}
                style={[
                  styles.serviceStatusBox,
                  checkingPincode
                    ? styles.serviceCheckingBox
                    : isPincodeServiceable
                      ? styles.serviceAvailableBox
                      : isPincodeInArea
                        ? { backgroundColor: "#FFF3E0", borderColor: "#FFE0B2" }
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
                        : isPincodeInArea
                          ? "alert-circle"
                          : "close-circle"
                  }
                  size={18}
                  color={
                    checkingPincode
                      ? "#64748b"
                      : isPincodeServiceable
                        ? "#10B981"
                        : isPincodeInArea
                          ? "#F57C00"
                          : "#EF4444"
                  }
                />

                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceStatusText}>
                    {checkingPincode
                      ? t("checkout.checking")
                      : isPincodeServiceable
                        ? t("checkout.serviceAvailable")
                        : isPincodeInArea
                          ? "No Partners Available Right Now"
                          : t("checkout.serviceNotAvailable")}
                  </Text>

                  {!checkingPincode && (
                    <Text style={styles.serviceSubText} numberOfLines={1}>
                      {isPincodeServiceable
                        ? "You can continue with booking."
                        : isPincodeInArea
                          ? "Tap for Emergency Booking (+91 7617618567)"
                          : "We will be available soon in your area."}
                    </Text>
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>

        <Text style={[styles.pageTitle, { color: theme.text, marginTop: 28 }]}>{t("schedule.title")}</Text>

        {/* MONTH / YEAR */}
        <View style={styles.dropdownRow}>
          <Pressable style={[styles.pickerBtn, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]} onPress={() => setShowMonthPicker(true)}>
            <Text style={[styles.pickerBtnText, { color: theme.text }]}>{MONTHS[month]}</Text>
            <Text style={[styles.pickerArrow, { color: theme.textLight }]}>▼</Text>
          </Pressable>

          <Pressable style={[styles.pickerBtn, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]} onPress={() => setShowYearPicker(true)}>
            <Text style={[styles.pickerBtnText, { color: theme.text }]}>{String(year)}</Text>
            <Text style={[styles.pickerArrow, { color: theme.textLight }]}>▼</Text>
          </Pressable>
        </View>

        {/* Month Picker Modal */}
        <Modal visible={showMonthPicker} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowMonthPicker(false)}>
          <Pressable style={styles.pickerOverlay} onPress={() => setShowMonthPicker(false)}>
            <View style={[styles.pickerModal, { width: 250, maxHeight: 300, backgroundColor: theme.background }]}>
              <FlatList
                data={MONTHS}
                keyExtractor={(item) => item}
                renderItem={({ item, index }) => (
                  <Pressable
                    style={[styles.pickerItem, month === index && styles.pickerItemSelected]}
                    onPress={() => { setMonth(index); setShowMonthPicker(false); }}
                  >
                    <Text style={[styles.pickerItemText, { color: theme.text }, month === index && styles.pickerItemTextSelected]}>{item}</Text>
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Modal>

        {/* Year Picker Modal */}
        <Modal visible={showYearPicker} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowYearPicker(false)}>
          <Pressable style={styles.pickerOverlay} onPress={() => setShowYearPicker(false)}>
            <View style={[styles.pickerModal, { width: 150, maxHeight: 200, backgroundColor: theme.background }]}>
              <FlatList
                data={availableYears}
                keyExtractor={(item) => String(item)}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.pickerItem, year === item && styles.pickerItemSelected]}
                    onPress={() => { setYear(item); setShowYearPicker(false); }}
                  >
                    <Text style={[styles.pickerItemText, { color: theme.text }, year === item && styles.pickerItemTextSelected]}>{String(item)}</Text>
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Modal>

        {/* CALENDAR */}
        <View style={[styles.calendar, { backgroundColor: theme.background }]}>
          <View style={{ flexDirection: "row" }}>
            {DAYS.map((d, i) => (
              <View key={d} style={styles.dayCol}>
                <Text style={[styles.dayLabel, { color: theme.textLight }]}>{d}</Text>

                {calendar[i].map((date: number | null, idx: number) => {
                  if (!date) return <View key={`empty-${idx}`} style={styles.emptyDate} />;

                  const disabled = isPastDate(year, month, date);
                  const selected = selectedDate === date;

                  return (
                    <Pressable
                      key={date}
                      disabled={disabled}
                      onPress={() => setSelectedDate(date)}
                      style={[
                        styles.dateBox,
                        selected && styles.selectedDate,
                        disabled && styles.disabledDate,
                      ]}
                    >
                      <Text
                        style={[
                          { color: theme.text },
                          selected && styles.selectedText,
                          disabled && { color: theme.textLight },
                        ]}
                      >
                        {date}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* TIME */}
        {selectedDate && (
          <>
            <Text style={[styles.section, { color: theme.text }]}>{t("schedule.selectTime")}</Text>

            <View style={styles.timeGrid}>
              {availableTimeSlots.map((time) => {
                const disabled = isSlotDisabled(time);
                return (
                  <Pressable
                    key={time}
                    disabled={disabled}
                    onPress={() => setSelectedTime(time)}
                    style={[
                      styles.timeBox,
                      { backgroundColor: theme.surfaceVariant, borderColor: theme.border },
                      disabled && {
                        backgroundColor: isDark ? "#2a2a2a" : "#f0f0f0",
                        borderColor: isDark ? "#333" : "#ddd",
                        opacity: 0.5,
                      },
                      selectedTime === time && styles.selectedTime,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeText,
                        { color: theme.text },
                        disabled && { color: theme.textLight },
                        selectedTime === time && styles.selectedText,
                      ]}
                    >
                      {time}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* PROCEED */}
        <Pressable
          disabled={
            !selectedDate ||
            !selectedTime ||
            selectedServices.length === 0 ||
            !profile?.full_name?.trim() ||
            !profile?.phone?.trim() ||
            profile.phone.replace(/\D/g, "").length !== 10 ||
            !manualAddress?.trim() ||
            pincode.trim().length !== 6 ||
            checkingPincode ||
            !isPincodeServiceable
          }
          style={[
            styles.primaryBtn,
            { backgroundColor: theme.primary, marginTop: 20 },
            (!selectedDate ||
              !selectedTime ||
              selectedServices.length === 0 ||
              !profile?.full_name?.trim() ||
              !profile?.phone?.trim() ||
              profile.phone.replace(/\D/g, "").length !== 10 ||
              !manualAddress?.trim() ||
              pincode.trim().length !== 6 ||
              checkingPincode ||
              !isPincodeServiceable) &&
            styles.disabledBtn,
          ]}
          onPress={async () => {
            const bookingDateText = `${selectedDayName}, ${selectedDate} ${MONTHS[month]} ${year} at ${selectedTime}`;

            // Save/Update Profile in Supabase
            if (userId) {
              const fullAddressStr = `${manualAddress.trim()} - ${pincode.trim()}`;
              await supabase
                .from("profile")
                .update({
                  full_name: profile?.full_name?.trim(),
                  phone: profile?.phone?.trim(),
                  address: fullAddressStr,
                  pincode: pincode.trim(),
                })
                .eq("id", userId);
            }

            navigation.navigate("Checkout", {
              services: selectedServices,
              bookingDateText,
            });
          }}
        >
          <Text style={[styles.primaryText, { color: theme.background }]}>{t("schedule.proceed")}</Text>
        </Pressable>

        {/* ================= ADD SERVICE MODAL ================= */}
        <Modal visible={showAddService} animationType="slide" statusBarTranslucent={true}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 10 }}>
            <AnimatedGradientBorder
              borderRadius={20}
              borderWidth={2}
              animationSpeed={3}
              style={{ flex: 1, maxHeight: "80%" }}
            >
              <View style={{ flex: 1, backgroundColor: theme.background, borderRadius: 20, padding: 20 }}>
                <View style={styles.addHeader}>
                  <Text style={[styles.addTitle, { color: theme.text }]}>{t("schedule.addService")}</Text>
                  <Pressable onPress={() => setShowAddService(false)}>
                    <Text style={[styles.close, { color: theme.text }]}>✕</Text>
                  </Pressable>
                </View>

                <ScrollView style={{ marginTop: 20 }}>
                  {allServices.map((s) => {
                    const exists = editServices.some((x) => x.id === s.id);

                    return (
                      <View key={s.id} style={[styles.addRow, { borderColor: theme.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.bold, { color: theme.text }]}>{s.title}</Text>
                          <Text style={{ color: theme.textLight }}>{s.duration}</Text>
                          <Text style={{ color: theme.text }}>{s.price}</Text>
                        </View>

                        <Pressable
                          disabled={exists}
                          onPress={() => {
                            setEditServices((prev) => [
                              ...prev,
                              {
                                id: s.id,
                                title: s.title,
                                duration: s.duration,
                                price: s.price,
                                original_price: s.original_price,
                                discount_percent: s.discount_percent,
                                discount_label: (s as any)?.discount_label ?? null,
                                tax_percent: (s as any)?.tax_percent ?? null,
                              },
                            ]);
                            setShowAddService(false);
                          }}
                          style={[
                            styles.addBtn,
                            exists && { backgroundColor: "#ccc" },
                          ]}
                        >
                          <Text style={{ color: "#fff", fontSize: 22 }}>＋</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </AnimatedGradientBorder>
          </View>
        </Modal>
      </ScrollView>

      {/* ================= ADDONS LIST MODAL ================= */}
      <Modal visible={showAddonsModal} transparent animationType="slide" statusBarTranslucent={true}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "bottom"]}>
          <View
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 20 }}

          >
            <AnimatedGradientBorder
              borderRadius={20}
              borderWidth={2}
              animationSpeed={3}
              style={{ width: "100%", maxHeight: "80%", alignSelf: "stretch", flex: 1 }}
              flex={1}
            >
              <View style={{ flex: 1, backgroundColor: theme.background, borderRadius: 20 }}>
                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 15,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  }}
                >
                  <Text style={{ fontSize: 20, fontWeight: "800", color: theme.text }}>{t("schedule.addons")}</Text>
                  <Pressable
                    onPress={() => {
                      setShowAddonsModal(false);
                    }}
                  >
                    <Text style={{ fontSize: 20, padding: 5, color: theme.text }}>✕</Text>
                  </Pressable>
                </View>

                <ScrollView
                  contentContainerStyle={{ padding: 16 }}
                  scrollEventThrottle={16}
                >
                  {filteredAddons.length === 0 ? (
                    <Text style={{ textAlign: "center", marginTop: 20, color: "#888" }}>
                      No extra add-ons available.
                    </Text>
                  ) : (
                    filteredAddons.map((addon) => {
                      const isAdded = editServices.some(
                        (s) => s.id === addon.id
                      );

                      return (
                        <View
                          key={addon.id}
                          style={{
                            flexDirection: "row",
                            backgroundColor: theme.background,
                            borderRadius: 14,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: theme.border,
                            overflow: "hidden",
                            padding: 10,
                          }}
                        >
                          {/* Left Side: Image */}
                          <View style={{ width: 100, height: 100, borderRadius: 10, overflow: 'hidden' }}>
                            {addon.image && addon.image.trim() !== '' ? (
                              <Image
                                source={{ uri: addon.image }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                              />
                            ) : (
                              <View
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  backgroundColor: isDark ? "#333" : "#f0f0f0",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text style={{ color: "#ccc", fontSize: 10 }}>No Image</Text>
                              </View>
                            )}
                          </View>

                          {/* Right Side: Details */}
                          <View
                            style={{
                              flex: 1,
                              paddingLeft: 12,
                              justifyContent: "center",
                            }}
                          >
                            <View>
                              <Text style={{ fontSize: 16, fontWeight: "800", color: theme.text }} numberOfLines={1}>
                                {addon.title}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 13,
                                  color: theme.textLight,
                                  marginTop: 2,
                                }}
                              >
                                {addon.duration} mins
                              </Text>

                              <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text, marginTop: 2 }}>
                                {String(addon.price).startsWith('₹') ? addon.price : `₹${addon.price}`}
                              </Text>
                            </View>

                            {/* Action Buttons */}
                            <View
                              style={{
                                flexDirection: "row",
                                gap: 8,
                                marginTop: 10,
                              }}
                            >
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setShowAddonsModal(false);
                                  setSelectedAddonDetail(addon);
                                }}
                                style={{
                                  flex: 1,
                                  paddingVertical: 10,
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor: "#E5E7EB",
                                  backgroundColor: "#F9FAFB",
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151" }}>
                                  {t("schedule.view")}
                                </Text>
                              </Pressable>

                              {isAdded ? (
                                <View
                                  style={{
                                    flex: 1.2,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: 'space-between',
                                    backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                  }}
                                >
                                  <Pressable
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      decrementAddon(addon.id);
                                    }}
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingVertical: 8,
                                    }}
                                  >
                                    <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text }}>
                                      -
                                    </Text>
                                  </Pressable>

                                  <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>
                                    {editServices.find((s) => s.id === addon.id)?.quantity || 1}
                                  </Text>

                                  <Pressable
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      addAddonToCart(addon);
                                    }}
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingVertical: 8,
                                    }}
                                    disabled={(editServices.find((s) => s.id === addon.id)?.quantity || 1) >= (addon.max_quantity || 3)}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 20,
                                        fontWeight: "700",
                                        color: (editServices.find((s) => s.id === addon.id)?.quantity || 1) >= (addon.max_quantity || 3) ? theme.textLight : theme.text
                                      }}
                                    >
                                      +
                                    </Text>
                                  </Pressable>
                                </View>
                              ) : (
                                <Pressable
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    addAddonToCart(addon);
                                  }}
                                  style={{
                                    flex: 1.2,
                                    backgroundColor: COLORS.saffron,
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    alignItems: "center",
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 13,
                                      fontWeight: "700",
                                      color: "#000",
                                    }}
                                  >
                                    + {t("schedule.add")}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </AnimatedGradientBorder>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ================= ADDON DETAIL MODAL ================= */}
      {selectedAddonDetail && (
        <Modal
          visible={!!selectedAddonDetail}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedAddonDetail(null)}
          statusBarTranslucent={true}
        >
          <View
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 10, paddingTop: insets.top + 10 }}

          >
            <AnimatedGradientBorder
              borderRadius={20}
              borderWidth={2}
              animationSpeed={3}
              style={{ maxHeight: "80%" }}
              flex={1}
            >
              <View style={{ flex: 1, backgroundColor: theme.background, borderRadius: 20, overflow: 'hidden' }}>
                {/* Close Button absolute top right */}
                <Pressable
                  onPress={() => setSelectedAddonDetail(null)}
                  style={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    zIndex: 10,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    borderRadius: 20,
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✕</Text>
                </Pressable>

                <ScrollView
                  style={{ flex: 1 }}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                  decelerationRate="normal"
                >
                  {/* Full Image */}
                  <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                    {selectedAddonDetail.image && selectedAddonDetail.image.trim() !== '' ? (
                      <Image
                        source={{ uri: selectedAddonDetail.image }}
                        style={{ width: "100%", height: 280, borderRadius: 16 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: "100%",
                          height: 200,
                          backgroundColor: theme.surfaceVariant,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 16,
                        }}
                      >
                        <Text style={{ color: theme.textLight }}>No Image Available</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ padding: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: "800", color: theme.text }}>{selectedAddonDetail.title}</Text>
                    <Text style={{ fontSize: 14, color: theme.textLight, marginTop: 4 }}>{selectedAddonDetail.duration} mins • {selectedAddonDetail.service_type || 'Add-on'}</Text>

                    {/* Description */}
                    {selectedAddonDetail.description && (
                      <>
                        <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: theme.text }}>Description</Text>
                        <Text style={{ fontSize: 15, lineHeight: 22, marginTop: 8, color: theme.text }}>{selectedAddonDetail.description}</Text>
                      </>
                    )}

                    {/* Work Includes */}
                    {selectedAddonDetail.work_includes && selectedAddonDetail.work_includes.trim() ? (
                      <>
                        <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: COLORS.saffron }}>Work Includes</Text>
                        {parseTextList(selectedAddonDetail.work_includes).map((line, idx) => (
                          <View key={idx} style={{ flexDirection: "row", marginTop: 8 }}>
                            <Text style={{ marginRight: 8, fontSize: 15, color: theme.text }}>•</Text>
                            <Text style={{ fontSize: 15, flex: 1, lineHeight: 22, color: theme.text }}>{line}</Text>
                          </View>
                        ))}
                      </>
                    ) : null}

                    {/* Work Not Includes */}
                    {selectedAddonDetail.work_not_included && selectedAddonDetail.work_not_included.trim() ? (
                      <>
                        <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 24, color: "#D32F2F" }}>Work Not Includes</Text>
                        {parseTextList(selectedAddonDetail.work_not_included).map((line, idx) => (
                          <View key={idx} style={{ flexDirection: "row", marginTop: 8 }}>
                            <Text style={{ marginRight: 8, fontSize: 15, color: theme.textLight }}>•</Text>
                            <Text style={{ fontSize: 15, flex: 1, lineHeight: 22, color: theme.textLight }}>{line}</Text>
                          </View>
                        ))}
                      </>
                    ) : null}
                  </View>
                </ScrollView>

                {/* Pinned Bottom Area: Price and Add Button */}
                <View style={{
                  padding: 20,
                  paddingBottom: Math.max(insets.bottom, 20),
                  borderTopWidth: 1,
                  borderTopColor: theme.border,
                  backgroundColor: theme.background
                }}>
                  <PriceRow
                    price={selectedAddonDetail.price}
                    original_price={selectedAddonDetail.original_price}
                    discount_percent={selectedAddonDetail.discount_percent}
                    percentText={(selectedAddonDetail as any).discount_label}
                  />

                  {/* Action Button */}
                  {editServices.find(
                    (s) => s.id === selectedAddonDetail.id
                  ) ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
                        borderRadius: 10,
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        marginTop: 15,
                      }}
                    >
                      <Pressable
                        onPress={() => decrementAddon(selectedAddonDetail.id)}
                        style={{ paddingHorizontal: 20, paddingVertical: 8 }}
                      >
                        <Text style={{ fontSize: 24, fontWeight: "700", color: theme.text }}>-</Text>
                      </Pressable>

                      <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>
                        {editServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1}
                      </Text>

                      <Pressable
                        onPress={() => addAddonToCart(selectedAddonDetail)}
                        style={{ paddingHorizontal: 20, paddingVertical: 8 }}
                        disabled={(editServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1) >= (selectedAddonDetail.max_quantity || 3)}
                      >
                        <Text
                          style={{
                            fontSize: 24,
                            fontWeight: "700",
                            color: (editServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1) >= (selectedAddonDetail.max_quantity || 3) ? theme.textLight : theme.text
                          }}
                        >
                          +
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => addAddonToCart(selectedAddonDetail)}
                      style={{
                        backgroundColor: COLORS.saffron,
                        paddingVertical: 14,
                        borderRadius: 10,
                        alignItems: "center",
                        marginTop: 15,
                      }}
                    >
                      <Text style={{ color: "#000", fontWeight: "800", fontSize: 16 }}>+ Add</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </AnimatedGradientBorder>
          </View>
        </Modal>
      )}



      {/* Custom Alert Modal */}
      <Modal visible={showAlertModal} transparent animationType="fade" onRequestClose={() => setShowAlertModal(false)}>
        <View style={styles.alertOverlay}>
          <View style={[styles.alertContent, { backgroundColor: theme.background }]}>
            <Text style={[styles.alertTitle, { color: theme.text }]}>{alertConfig.title}</Text>
            <Text style={[styles.alertMessage, { color: theme.textLight }]}>{alertConfig.message}</Text>
            <Pressable style={[styles.alertButton, { backgroundColor: theme.primary }]} onPress={() => setShowAlertModal(false)}>
              <Text style={[styles.alertButtonText, { color: theme.background }]}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Emergency Partner Contact Modal Popup */}
      <Modal
        visible={showEmergencyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmergencyModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20
          }}
          onPress={() => setShowEmergencyModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.background,
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 360,
              alignItems: "center",
              elevation: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 10
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "#FFF3E0",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 16
              }}
            >
              <Ionicons name="call" size={28} color="#F57C00" />
            </View>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: theme.text,
                textAlign: "center",
                marginBottom: 10
              }}
            >
              No Partners Available
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: theme.textLight,
                textAlign: "center",
                lineHeight: 20,
                marginBottom: 20
              }}
            >
              We regret, No partners are available at this moment. Please Contact us +91 7617618567 for emergency booking.
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor: "#F57C00",
                width: "100%",
                paddingVertical: 14,
                borderRadius: 12,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                marginBottom: 10
              }}
              onPress={() => {
                Linking.openURL("tel:7617618567").catch(() => { });
              }}
            >
              <Ionicons name="call-outline" size={20} color="#FFF" />
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>
                Call Emergency Support (+91 7617618567)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                paddingVertical: 10,
                width: "100%",
                alignItems: "center"
              }}
              onPress={() => setShowEmergencyModal(false)}
            >
              <Text style={{ color: theme.textLight, fontWeight: "600", fontSize: 14 }}>
                Close
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { padding: 20 },
  pageTitle: { fontSize: 26, fontWeight: "700" },

  dropdownRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  pickerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerBtnText: { fontSize: 16, fontWeight: "600", color: "#000" },
  pickerArrow: { fontSize: 10, color: "#666", marginLeft: 6 },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerModal: {
    backgroundColor: "#fff",
    borderRadius: 14,
    width: "80%",
    maxHeight: "60%",
    paddingVertical: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  pickerItemSelected: {
    backgroundColor: "#FFF8E1",
  },
  pickerItemText: {
    fontSize: 16,
    color: "#000",
  },
  pickerItemTextSelected: {
    fontWeight: "700",
    color: "#000",
  },

  calendar: { marginTop: 15 },
  dayCol: { alignItems: "center", width: 45 },
  dayLabel: { fontSize: 12, color: "#666" },

  dateBox: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyDate: { height: 38 },

  selectedDate: { backgroundColor: "#fbbf24", borderRadius: 6 },
  selectedText: { color: "#000", fontWeight: "600" },
  disabledDate: { opacity: 0.3 },
  disabledText: { color: "#aaa" },

  section: { fontSize: 18, fontWeight: "600", marginTop: 20 },

  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    columnGap: 12,
    marginTop: 10,
  },

  timeBox: {
    width: "30%",
    borderWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },

  timeText: { fontSize: 14 },

  selectedTime: {
    backgroundColor: "#fbbf24",
    borderColor: "#fbbf24",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  serviceCard: { marginTop: 10, borderRadius: 12, padding: 12, borderWidth: 1 },
  bold: { fontWeight: "600" },
  meta: { fontSize: 13, color: "#555" },

  primaryBtn: {
    backgroundColor: "#F4C430",
    padding: 16,
    borderRadius: 10,
    marginTop: 20,
  },

  disabledBtn: { backgroundColor: "#ccc" },

  primaryText: {
    color: "#000",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
  },

  modal: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 14,
  },

  close: { fontSize: 18 },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },

  remove: { color: "#000" },
  edit: { fontWeight: "600" },

  outlineBtn: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 12,
    alignItems: "center",
    borderRadius: 8,
    marginVertical: 10,
  },

  addHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  addTitle: { fontSize: 20, fontWeight: "700" },

  addRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    alignItems: "center",
  },

  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeading: {
    fontSize: 18,
    fontWeight: "700",
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  addressSection: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  summaryCard: {
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 12,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "700",
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
  secondaryBtn: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryBtnText: {
    fontWeight: "700",
    fontSize: 14,
  },
  serviceStatusBox: {
    width: "100%",
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
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  linkText: {
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
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
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 20,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: "70%",
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  modalCloseButton: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertContent: {
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  alertMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  alertButton: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
