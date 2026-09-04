import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Dimensions,
  FlatList,
  ImageSourcePropType,
  InteractionManager,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedGradientBorder from "../components/AnimatedGradientBorder";

import Header from "../components/Header";
import HomeHero from "../components/HomeHero";
import PromotionalBannerSlider, { PromotionalBanner } from "../components/PromotionalBannerSlider";
import ServiceCard from "../components/ServiceCard";
import WhyChooseUs from "../components/WhyChooseUs";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext"; // @ts-ignore
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";
import { useNotification } from "../hooks/useNotification";
import { supabase, SUPABASE_URL } from "../lib/supabase";
import LocationService from '../services/LocationService';
import { COLORS } from "../theme/colors";
import { MainCategory, Service } from "../types/service";
import { clearClaimedOffer, getClaimedOffer, setClaimedOffer } from "../utils/priceUtils";

const { width, height } = Dimensions.get("window");
const SLIDER_HEIGHT = height * 0.25; // Increased height to reduce empty space

// ✅ Fuzzy Search Helper (Levenshtein Distance)
const getLevenshteinDistance = (a: string, b: string) => {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

// ✅ Module-level flag: only show popup once per app session
let hasShownPopupThisSession = false;

export default function HomeScreen({ navigation }: any) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [activeMainCategory, setActiveMainCategory] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [measuredHeights, setMeasuredHeights] = useState<{ [key: string]: number }>({});
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomNavPadding = useBottomNavPadding();

  // ✅ Hero banners state
  const [heroBanners, setHeroBanners] = useState<ImageSourcePropType[]>([]);
  const [promotionalBanners, setPromotionalBanners] = useState<PromotionalBanner[]>([]);

  // ✅ Refs
  const sliderRef = useRef<FlatList>(null);
  const pagerRef = useRef<FlatList>(null);
  const scrollRef = useRef<ScrollView>(null); // Main ScrollView ref
  const isProgrammaticScroll = useRef(false);
  const [showGoUp, setShowGoUp] = useState(false);
  const popupSliderRef = useRef<FlatList>(null);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isUserSwiping, setIsUserSwiping] = useState(false);
  const [servicesY, setServicesY] = useState(0); // Store Y position of services section

  // ✅ Popup state
  const POPUP_WIDTH = Math.min(width - 48, 360);
  const [popupType, setPopupType] = useState<"APP_POPUP" | "OFFERS" | null>(null);
  const [appPopups, setAppPopups] = useState<{ title: string; description: string | null; image_url: string | null }[]>([]);
  const [popupIndex, setPopupIndex] = useState(0);
  const [activeOffers, setActiveOffers] = useState<{ service_type: string; title: string; offer_percentage: number; description: string | null }[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const { showToast } = useNotification();

  // ✅ Welcome Reward Popup state
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [welcomeCoupon, setWelcomeCoupon] = useState("");

  // ✅ Signup 40% OFF Offer Popup state
  const [showSignupOfferPopup, setShowSignupOfferPopup] = useState(false);
  const [signupOfferInfo, setSignupOfferInfo] = useState<{ title: string; id?: string } | null>(null);

  // ✅ Promo Banner state
  const [activePromoBanner, setActivePromoBanner] = useState<PromotionalBanner | null>(null);
  const [loadingPromoServices, setLoadingPromoServices] = useState(false);
  const [showServiceSelectModal, setShowServiceSelectModal] = useState(false);
  const [selectedPromoServiceId, setSelectedPromoServiceId] = useState<string | null>(null);
  const [promoBannerServices, setPromoBannerServices] = useState<any[]>([]);

  const checkWelcomeReward = useCallback(async () => {
    try {
      // Safely get the session without forcing a stressful backend refresh
      const { data: { session }, error: refreshError } = await supabase.auth.getSession();
      if (refreshError) throw refreshError;

      const user = session?.user;
      console.log("🔍 Checking Welcome Reward metadata...");

      if (user?.user_metadata?.show_welcome_reward && user?.user_metadata?.welcome_coupon_code) {
        console.log("🎁 Welcome Reward detected!", user.user_metadata.welcome_coupon_code);
        setWelcomeCoupon(user.user_metadata.welcome_coupon_code);

        // Short delay to ensure other UI is ready
        setTimeout(() => {
          setShowWelcomePopup(true);
        }, 1000);

        // Update metadata to NOT show it again
        await supabase.auth.updateUser({
          data: { show_welcome_reward: false }
        });
      }
    } catch (err) {
      console.error("Error checking welcome reward:", err);
    }
  }, []);

  const checkSignupOfferReward = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      const serviceTitle = user?.user_metadata?.signup_service_title;
      const serviceId = user?.user_metadata?.signup_service_id;
      const shouldShow = user?.user_metadata?.show_signup_offer_popup;

      if (shouldShow && serviceTitle) {
        setSignupOfferInfo({ title: serviceTitle, id: serviceId });

        setTimeout(() => {
          setShowSignupOfferPopup(true);
        }, 800);

        // Update metadata to NOT show it again on future visits
        await supabase.auth.updateUser({
          data: { show_signup_offer_popup: false }
        });
      }
    } catch (err) {
      console.error("Error checking signup offer reward:", err);
    }
  }, []);

  const handleGoToSignupService = useCallback(async () => {
    setShowSignupOfferPopup(false);
    if (!signupOfferInfo) return;

    // Search in loaded services list
    let matchingSvc = services.find(
      (s) =>
        (signupOfferInfo.id && s.id === signupOfferInfo.id) ||
        (signupOfferInfo.title && s.title?.toLowerCase().trim() === signupOfferInfo.title?.toLowerCase().trim())
    );

    // If not found in memory, query database directly
    if (!matchingSvc) {
      try {
        let query = supabase.from("services").select("*");
        if (signupOfferInfo.id) {
          query = query.eq("id", signupOfferInfo.id);
        } else if (signupOfferInfo.title) {
          query = query.eq("title", signupOfferInfo.title);
        }
        const { data } = await query.maybeSingle();
        if (data) matchingSvc = data;
      } catch (e) {
        console.log("Error querying service for signup offer:", e);
      }
    }

    if (matchingSvc) {
      navigation.navigate("ServiceDetail", { service: matchingSvc });
    } else {
      showToast("40% OFF discount saved! Browse services to select your booking.", "info");
    }
  }, [signupOfferInfo, services, navigation, showToast]);

  // ✅ Category Sheet state
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [selectedMainCategoryForSheet, setSelectedMainCategoryForSheet] = useState<MainCategory | null>(null);
  const isFocused = useIsFocused();

  const fetchServices = useCallback(async () => {
    const { data, error } = await supabase.from("services").select("*");

    if (error) {
      console.log("Supabase error:", error);
      return;
    }

    let serviceList = data || [];

    // ✅ Fetch active offers
    const { data: offersData } = await supabase
      .from("offers")
      .select("title, offer_percentage")
      .eq("is_offer_enabled", true);

    if (offersData && offersData.length > 0) {
      serviceList = serviceList.map((svc: any) => {
        const matchingOffer = offersData.find(
          (o) => o.title.toLowerCase() === svc.title.toLowerCase()
        );
        if (matchingOffer && matchingOffer.offer_percentage > 0) {
          return {
            ...svc,
            discount_label: `${matchingOffer.offer_percentage}% OFF`,
            discount_percent: matchingOffer.offer_percentage,
          };
        }
        return svc;
      });
    }

    setServices(serviceList);
  }, []);

  const fetchMainCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("main_categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.log("Main Categories error:", error);
      return;
    }
    setMainCategories(data || []);
    // Optional: Set the first one as active by default if you want
    // if (data && data.length > 0) setActiveMainCategory(data[0].id);
  }, []);

  const handleBannerPress = useCallback(async (banner: PromotionalBanner) => {
    console.log("[PROMO] Banner tapped");
    console.log("[PROMO] Service scope:", banner.service_scope);

    if (!banner.offer_percentage || banner.offer_percentage <= 0) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check for specific banner reuse
        const { count: bannerCount } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .eq("promotional_banner_id", banner.id)
          .eq("payment_verified", true)
          .ilike("payment_status", "paid");

        if (bannerCount && bannerCount > 0) {
          showToast("This offer has already been used.", "info");
          return;
        }

        // Check for NEW_USER eligibility if banner is for new users
        if (banner.customer_type === "new") {
          const { count: totalPaidCount } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("user_id", session.user.id)
            .eq("payment_verified", true)
            .ilike("payment_status", "paid");

          if (totalPaidCount && totalPaidCount > 0) {
            showToast("This offer is for new users only.", "info");
            // If they have a stale NEW_USER claim locally, clear it since they are no longer eligible
            const existing = await getClaimedOffer();
            if (existing && existing.type === "NEW_USER") {
              await clearClaimedOffer();
            }
            return;
          }
        }
      }

      const existingClaim = await getClaimedOffer();
      console.log("[PROMO] Existing claimed offer:", existingClaim);

      if (existingClaim) {
        console.log("[COUPON STEP 8] Existing claim:", existingClaim);

        if (existingClaim.bannerId === banner.id) {
          // It's the same banner. Do not return early.
          // Allow the flow to continue so the service selection modal opens.
          console.log("[PROMO] Same banner already claimed locally, proceeding to service selection.");
        } else if (existingClaim.type === "GENERIC_OFFER") {
          // Preserve generic offers
          showToast("An offer is already claimed.", "info");
          return;
        } else {
          // Different banner or stale claim -> clear it to allow the new one
          console.log("[COUPON STEP 8] Clearing different/stale claim to allow new banner.");
          await clearClaimedOffer();
        }
      }

      if (banner.service_scope === "selected") {
        setActivePromoBanner(banner);
        setLoadingPromoServices(true);
        setShowServiceSelectModal(true);
        setSelectedPromoServiceId(null);

        console.log("[PROMO] Fetching services for banner:", banner.id);
        const { data: svcRels } = await supabase
          .from("promotional_banner_services")
          .select("service_id")
          .eq("banner_id", banner.id);

        if (svcRels && svcRels.length > 0) {
          const serviceIds = svcRels.map(r => r.service_id);
          console.log("[PROMO] Promotional service IDs:", serviceIds);
          const { data: svcData } = await supabase
            .from("services")
            .select("id, title")
            .in("id", serviceIds);

          if (svcData) {
            console.log("[PROMO] Services displayed:", svcData);
            setPromoBannerServices(svcData);
          }
        }
        setLoadingPromoServices(false);
      } else {
        const claimType = banner.customer_type === "new" ? "NEW_USER" : "PROMOTIONAL_BANNER";
        console.log("[COUPON STEP 8] Banner customer_type:", banner.customer_type);
        console.log("[COUPON STEP 8] Claim type:", claimType);
        console.log("[COUPON STEP 8] Offer percentage:", banner.offer_percentage);

        const claimObject: any = {
          type: claimType,
          bannerId: banner.id,
          offerPercentage: banner.offer_percentage,
          claimedAt: new Date().toISOString(),
        };
        console.log("[PROMO] Final claim:", claimObject);
        await setClaimedOffer(claimObject);
        console.log("[COUPON STEP 8] Applying promotional banner:", claimObject);
        console.log("[COUPON STEP 3] New user claim created:", claimObject);
        console.log("[COUPON STEP 3] New claim type:", claimObject.type);
        showToast(`Offer Claimed! ${banner.offer_percentage}% discount is ready for your booking.`, "success");
      }
    } catch (e) {
      console.error("Error claiming banner offer:", e);
      showToast("Failed to claim offer. Please try again.", "error");
    }
  }, [showToast]);

  const handleSelectedServiceClaim = async () => {
    if (!selectedPromoServiceId || !activePromoBanner) return;

    const selectedSvc = promoBannerServices.find(s => s.id === selectedPromoServiceId);
    if (!selectedSvc) return;

    console.log("[PROMO] Selected service:", selectedSvc);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { count } = await supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .eq("user_id", session.user.id)
          .eq("promotional_banner_id", activePromoBanner.id)
          .eq("payment_status", "paid")
          .eq("payment_verified", true);

        if (count && count > 0) {
          showToast("Offer already used.", "info");
          setShowServiceSelectModal(false);
          return;
        }
      }

      console.log("[PROMO] Claiming selected service offer:", selectedSvc.title);
      const claimType = activePromoBanner.customer_type === "new" ? "NEW_USER" : "PROMOTIONAL_BANNER";
      console.log("[COUPON STEP 8] Banner customer_type:", activePromoBanner.customer_type);
      console.log("[COUPON STEP 8] Claim type:", claimType);
      console.log("[COUPON STEP 8] Offer percentage:", activePromoBanner.offer_percentage);

      const claimObject: any = {
        type: claimType,
        bannerId: activePromoBanner.id,
        serviceId: selectedSvc.id,
        serviceTitle: selectedSvc.title,
        offerPercentage: activePromoBanner.offer_percentage ?? 0,
        claimedAt: new Date().toISOString(),
      };

      await setClaimedOffer(claimObject);
      console.log("[COUPON STEP 8] Applying promotional banner:", claimObject);
      console.log("[COUPON STEP 3] New user claim created:", claimObject);
      console.log("[COUPON STEP 3] New claim type:", claimObject.type);

      setShowServiceSelectModal(false);
      console.log("[PROMO] Claim successful");
      showToast(`Offer Claimed! ${activePromoBanner.offer_percentage}% discount is ready for your booking.`, "success");
    } catch (e) {
      console.error("Error claiming selected service offer:", e);
      showToast("Failed to claim offer. Please try again.", "error");
    }
  };

  const fetchHeroBanners = useCallback(async () => {
    const { data, error } = await supabase
      .from("hero_banners")
      .select("image_path")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    const fallbackBanners: ImageSourcePropType[] = [
      require("../../assets/images/1.png"),
      require("../../assets/images/2.png"),
      require("../../assets/images/3.png"),
    ];

    if (error) {
      setHeroBanners(fallbackBanners);
      return;
    }

    if (data && data.length > 0) {
      const bannerUrls = data.map(
        (banner) => ({ uri: `${SUPABASE_URL}/storage/v1/object/public/hero-images/${banner.image_path}` })
      );
      setHeroBanners(bannerUrls);
      return;
    }
    setHeroBanners(fallbackBanners);
  }, []);

  const fetchPromotionalBanners = useCallback(async () => {
    const { data, error } = await supabase
      .from("promotional_banners")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.log("Promotional Banners error:", error);
      return;
    }

    if (data) {
      // --- Phase 2 Customer, Location, and Service Eligibility Check ---
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        let bookingCount = 0;
        if (userId) {
          const { count, error: countError } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

          if (!countError && count !== null) {
            bookingCount = count;
          }
        }

        let customerPincode: string | null = null;
        let customerHubIds: string[] = [];

        try {
          const locResult = await LocationService.getSelectedLocation();
          if (locResult && locResult.postalCode) {
            customerPincode = locResult.postalCode;
          }

          if (customerPincode) {
            const { data: hubData } = await supabase
              .from("hub_locations")
              .select("id")
              .eq("pincode", customerPincode);

            if (hubData) {
              customerHubIds = hubData.map(h => h.id);
            }
          }
        } catch (e) {
          console.log("Error resolving customer location:", e);
        }

        const { data: bannerLocations } = await supabase
          .from("promotional_banner_locations")
          .select("banner_id, location_id");

        const bannerLocMap: Record<string, string[]> = {};
        if (bannerLocations) {
          bannerLocations.forEach(bl => {
            if (!bannerLocMap[bl.banner_id]) {
              bannerLocMap[bl.banner_id] = [];
            }
            bannerLocMap[bl.banner_id].push(bl.location_id);
          });
        }

        // Fetch service scopes
        const { data: bannerServices } = await supabase
          .from("promotional_banner_services")
          .select("banner_id, service_id");

        const bannerSvcMap: Record<string, string[]> = {};
        if (bannerServices) {
          bannerServices.forEach(bs => {
            if (!bannerSvcMap[bs.banner_id]) {
              bannerSvcMap[bs.banner_id] = [];
            }
            bannerSvcMap[bs.banner_id].push(bs.service_id);
          });
        }

        // HomeScreen does NOT have a specific current service context active.
        const currentServiceId: string | null = null;

        console.log("=== BANNER ELIGIBILITY CHECK ===");
        console.log("User ID:", userId);
        console.log("Booking Count:", bookingCount);
        console.log("Customer Pincode:", customerPincode);
        console.log("Resolved Hub IDs:", customerHubIds);
        console.log("Current Service ID:", currentServiceId);

        const eligibleBanners = data.filter(banner => {
          // 1. Customer Check
          let customerEligible = false;
          if (!banner.customer_type || banner.customer_type === "everyone") {
            customerEligible = true;
          } else if (banner.customer_type === "new") {
            customerEligible = bookingCount === 0;
          } else if (banner.customer_type === "existing") {
            customerEligible = bookingCount > 0;
          }

          // 2. Location Check
          let locationEligible = false;
          if (!banner.pincode_scope || banner.pincode_scope === "all") {
            locationEligible = true;
          } else if (banner.pincode_scope === "selected") {
            const allowedLocs = bannerLocMap[banner.id] || [];
            locationEligible = customerHubIds.some(hubId => allowedLocs.includes(hubId));
          }

          // 3. Service Check is deferred to the modal for banner visibility on HomeScreen
          // The banner should be visible as long as customer and location match
          let serviceEligible = true;

          const finalEligible = customerEligible && locationEligible;

          console.log(`Banner ${banner.id} | CustType: ${banner.customer_type} (${customerEligible}) | LocScope: ${banner.pincode_scope} (${locationEligible}) | Final: ${finalEligible} `);
          return finalEligible;
        });

        console.log("================================");
        setPromotionalBanners(eligibleBanners);
      } catch (err) {
        console.error("Error evaluating banner eligibility:", err);
        setPromotionalBanners(data);
      }
    }
  }, []);

  const fetchPopups = useCallback(async () => {
    if (hasShownPopupThisSession) return;

    const { data: popupData } = await supabase
      .from("app_popups")
      .select("*")
      .eq("is_active", true);

    const { data: offersData } = await supabase
      .from("offers")
      .select("*")
      .eq("is_offer_enabled", true);

    if (popupData && popupData.length > 0) {
      setAppPopups(popupData);
    }

    if (offersData && offersData.length > 0) {
      setActiveOffers(offersData);
    }

    if (popupData && popupData.length > 0) {
      setPopupType("APP_POPUP");
      setShowPopup(true);
      hasShownPopupThisSession = true;
    } else if (offersData && offersData.length > 0) {
      setPopupType("OFFERS");
      setShowPopup(true);
      hasShownPopupThisSession = true;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadAll = async () => {
        try {
          await Promise.all([fetchMainCategories(), fetchServices()]);
          await Promise.all([fetchHeroBanners(), fetchPromotionalBanners(), fetchPopups()]);
          await checkWelcomeReward();
          await checkSignupOfferReward();
        } catch (err) {
          console.error("Home load error:", err);
        } finally {
          setLoading(false);
        }
      };

      // Wait for navigation transition to finish before fetching
      const interactionPromise = InteractionManager.runAfterInteractions(() => {
        loadAll();
      });

      return () => interactionPromise.cancel();
    }, [fetchServices, fetchHeroBanners, fetchPromotionalBanners, fetchPopups, fetchMainCategories, checkWelcomeReward, checkSignupOfferReward])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMainCategories(), fetchServices(), fetchHeroBanners(), fetchPromotionalBanners(), fetchPopups()]);
    setRefreshing(false);
  };

  const tabs = useMemo(() => {
    const categoryMap = new Map<string, number>();

    // Filter services by active main category
    const filteredServices = activeMainCategory
      ? services.filter(s => s.main_category_id === activeMainCategory)
      : services;

    filteredServices.forEach((s) => {
      if (s.service_type && !categoryMap.has(s.service_type)) {
        categoryMap.set(s.service_type, s.category_order ?? 999);
      }
    });

    const sorted = Array.from(categoryMap.entries()).sort((a, b) => a[1] - b[1]);

    const result = sorted.map(([type]) => ({
      label: type.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: type,
    }));

    if (result.length > 0) {
      return [{ label: t("home.allServices"), value: "ALL" }, ...result];
    }
    return result;
  }, [services, t, activeMainCategory]);

  // Sync activeCategory when tabs change
  useEffect(() => {
    if (tabs.length > 0) {
      const exists = tabs.find(t => t.value === activeCategory);
      if (!exists) setActiveCategory(tabs[0].value);
    }
  }, [tabs, activeCategory]);

  // ✅ Get unique sub-categories for the bottom sheet
  const subCategories = useMemo(() => {
    if (!selectedMainCategoryForSheet) return [];

    // Use a map to track unique types AND their first found icon
    const typeMap = new Map<string, { label: string, value: string, icon: string | null, order?: number }>();

    services
      .filter(s => s.main_category_id === selectedMainCategoryForSheet.id)
      .forEach(s => {
        if (s.service_type) {
          const type = s.service_type;
          const existing = typeMap.get(type);

          // If we haven't found this type yet, OR if we found it but it didn't have an icon and this one does
          if (!existing || (!existing.icon && s.category_icon_url)) {
            typeMap.set(type, {
              label: type.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              value: type,
              icon: s.category_icon_url || existing?.icon || null,
              order: s.category_order ?? existing?.order ?? 9999
            });
          }
        }
      });

    const result = Array.from(typeMap.values());

    // Add 4 specific containers for Insta Help if they don't exist
    if (selectedMainCategoryForSheet.name === "Insta Help") {
      const instaItems = [
        "Kitchen Utensil Cleaning",
        "Clothes Ironing",
        "Clothes Folding",
        "Floor Mopping"
      ];

      instaItems.forEach(label => {
        if (!result.some(r => r.label === label)) {
          result.push({
            label,
            value: label.toUpperCase().replace(/\s+/g, "_"),
            icon: null,
            order: 9999
          });
        }
      });
    }

    result.sort((a, b) => {
      const orderA = a.order ?? 9999;
      const orderB = b.order ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return a.label.localeCompare(b.label);
    });

    return result;
  }, [services, selectedMainCategoryForSheet]);

  // ✅ New hook to precalculate all subcategories for all main categories to render on HomeScreen
  const allSubCategoriesByMainCategory = useMemo(() => {
    const result = new Map<string, { label: string, value: string, icon: string | null, order?: number }[]>();

    mainCategories.forEach(mainCat => {
      const typeMap = new Map<string, { label: string, value: string, icon: string | null, order?: number }>();

      services
        .filter(s => s.main_category_id === mainCat.id)
        .forEach(s => {
          if (s.service_type) {
            const type = s.service_type;
            const existing = typeMap.get(type);

            if (!existing || (!existing.icon && s.category_icon_url)) {
              typeMap.set(type, {
                label: type.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                value: type,
                icon: s.category_icon_url || existing?.icon || null,
                order: s.category_order ?? existing?.order ?? 9999
              });
            }
          }
        });

      const catSubs = Array.from(typeMap.values());

      if (mainCat.name === "Insta Help" || mainCat.name === "Express Home Cleaning") {
        const instaItems = [
          "Kitchen Utensil Cleaning",
          "Clothes Ironing",
          "Clothes Folding",
          "Floor Mopping"
        ];

        instaItems.forEach(label => {
          if (!catSubs.some(r => r.label === label)) {
            catSubs.push({
              label,
              value: label.toUpperCase().replace(/\s+/g, "_"),
              icon: null,
              order: 9999
            });
          }
        });
      }

      catSubs.sort((a, b) => {
        const orderA = a.order ?? 9999;
        const orderB = b.order ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return a.label.localeCompare(b.label);
      });

      result.set(mainCat.id, catSubs);
    });

    return result;
  }, [mainCategories, services]);

  const getServicesForCategory = useCallback(
    (categoryValue: string) => {
      const search = (searchText ?? "").trim().toLowerCase();
      return services.filter((service) => {
        // Must match active Main Category if one is selected
        if (activeMainCategory && service.main_category_id !== activeMainCategory) return false;

        const matchesCategory = categoryValue === "ALL" || service.service_type === categoryValue;
        if (!matchesCategory) return false;
        if (search.length === 0) return true;

        const title = (service.title ?? "").toLowerCase();
        const type = (service.service_type ?? "").toLowerCase();

        if (title.includes(search) || type.includes(search)) return true;
        if (search.length > 3 && getLevenshteinDistance(search, type) <= 2) return true;
        return false;
      }).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    },
    [services, searchText, activeMainCategory]
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      setActiveCategory(value);
      const idx = tabs.findIndex((t) => t.value === value);
      if (idx >= 0 && pagerRef.current) {
        isProgrammaticScroll.current = true;
        pagerRef.current.scrollToIndex({ index: idx, animated: true });
        setTimeout(() => { isProgrammaticScroll.current = false; }, 400);
      }
    },
    [tabs]
  );

  const onPagerScrollEnd = useCallback(
    (e: any) => {
      if (isProgrammaticScroll.current) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / width);
      if (tabs[idx]) setActiveCategory(tabs[idx].value);
    },
    [tabs]
  );

  const renderCategoryPage = useCallback(
    ({ item: tab }: { item: { label: string; value: string } }) => {
      const pageServices = getServicesForCategory(tab.value);
      return (
        <View style={{ width }}>
          {pageServices.length === 0 ? (
            <View style={{ marginTop: 60, alignItems: "center" }}>
              <Ionicons name="search-outline" size={40} color={theme.textMuted} />
              <Text style={{ marginTop: 12, color: theme.textMuted, fontSize: 16 }}>{t("home.noResults")}</Text>
            </View>
          ) : (
            <FlatList
              data={pageServices}
              keyExtractor={(s) => s.id}
              scrollEnabled={false}
              numColumns={2}
              columnWrapperStyle={{ gap: 12, paddingHorizontal: 12 }}
              renderItem={({ item }) => (
                <ServiceCard service={item} onPress={() => navigation.navigate("ServiceDetail", { service: item })} />
              )}
              contentContainerStyle={{ paddingBottom: 16 }}
              onContentSizeChange={(_, h) => {
                if (measuredHeights[tab.value] !== h) {
                  setMeasuredHeights((prev) => ({ ...prev, [tab.value]: h }));
                }
              }}
            />
          )}
        </View>
      );
    },
    [getServicesForCategory, navigation, t, theme, measuredHeights]
  );

  const activeCategoryServices = getServicesForCategory(activeCategory);
  const CARD_ROW_HEIGHT = 320; // Safe fallback height to prevent any layout cutoffs
  const serviceRows = Math.max(1, Math.ceil(activeCategoryServices.length / 2));
  const pagerHeight = activeCategoryServices.length === 0
    ? 150
    : (measuredHeights[activeCategory] || (serviceRows * CARD_ROW_HEIGHT));

  // Auto-slide effect
  useEffect(() => {
    if (heroBanners.length <= 1) return;
    const interval = setInterval(() => {
      if (!isUserSwiping) {
        setCurrentSlide((prev) => {
          const next = (prev + 1) % heroBanners.length;
          sliderRef.current?.scrollToIndex({ index: next, animated: true });
          return next;
        });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [heroBanners.length, isUserSwiping]);

  const navigateToExpressCleaning = useCallback(() => {
    // Check if it's a specific service
    const expressService = services.find(s => s.title?.toLowerCase().includes("express"));
    if (expressService) {
      navigation.navigate("ServiceDetail", { service: expressService });
      return;
    }

    // Check if it's a main category
    const expressCategory = mainCategories.find(c => c.name.toLowerCase().includes("express"));
    if (expressCategory) {
      const subs = allSubCategoriesByMainCategory.get(expressCategory.id) || [];
      navigation.navigate("CategoryServices", {
        mainCategoryName: expressCategory.name,
        mainCategoryId: expressCategory.id,
        subCategories: subs
      });
      return;
    }

    // Fallback
    scrollRef.current?.scrollTo({ y: servicesY || 0, animated: true });
  }, [services, mainCategories, allSubCategoriesByMainCategory, navigation, servicesY]);


  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ backgroundColor: "#FFC928", flex: 0 }} edges={["top"]} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFC928" />


        <ScrollView
          ref={scrollRef}
          onScroll={(e) => setShowGoUp(e.nativeEvent.contentOffset.y > 200)}
          scrollEventThrottle={16}

          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
              progressBackgroundColor={theme.background}
            />
          }
          contentContainerStyle={[{ backgroundColor: theme.background }, bottomNavPadding]}
        >
          {/* 1. Header (Logo + Search) */}
          <Header />

          {/* 2. Hero Slider */}
          <HomeHero onBookNow={navigateToExpressCleaning} />

          {/* New User Promo Banner (Matching Website Image 1) */}
          <PromotionalBannerSlider banners={promotionalBanners} theme={theme} onBannerPress={handleBannerPress} />


          {/* 3. Main Category Grid (Explore all services) */}
          {mainCategories.length > 0 && (
            <View style={styles.gridContainer} onLayout={(e) => setServicesY(e.nativeEvent.layout.y)}>
              <View style={styles.grid}>
                {mainCategories.map((mainCat) => (
                  <Pressable
                    key={mainCat.id}
                    style={styles.gridItem}
                    onPress={() => {
                      const subs = allSubCategoriesByMainCategory.get(mainCat.id) || [];
                      navigation.navigate("CategoryServices", {
                        mainCategoryName: mainCat.name,
                        mainCategoryId: mainCat.id,
                        subCategories: subs
                      });
                    }}
                  >
                    {({ pressed }) => (
                      <>
                        <View style={[styles.gridIconContainer, pressed && styles.gridItemActive]}>
                          {mainCat.icon_url ? (
                            <Image source={{ uri: mainCat.icon_url }} style={styles.gridIcon} contentFit="contain" />
                          ) : (
                            <Ionicons name="apps-outline" size={32} color={theme.primary} />
                          )}
                        </View>
                        <Text style={[styles.gridLabel, { color: theme.text }]} numberOfLines={2}>
                          {mainCat.name}
                        </Text>
                      </>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          )}


          {/* 6. Why Choose Us Section */}
          <WhyChooseUs onBookNow={navigateToExpressCleaning} />
        </ScrollView>

      {/* Popups (Festive & Offers) */}
      <Modal visible={showPopup && !!popupType} transparent animationType="fade" onRequestClose={() => setShowPopup(false)}>
        <Pressable style={popupStyles.overlay} onPress={() => {
          if (popupType === "APP_POPUP" && activeOffers.length > 0) {
            setPopupType("OFFERS");
          } else {
            setShowPopup(false);
          }
        }}>
          <AnimatedGradientBorder borderRadius={20} borderWidth={2} animationSpeed={3} style={{ width: popupType === "APP_POPUP" ? POPUP_WIDTH : "90%" }}>
            <Pressable onPress={(e) => e.stopPropagation()} style={[popupStyles.container, { backgroundColor: theme.background }]}>
              <Pressable style={popupStyles.closeBtn} onPress={() => {
                if (popupType === "APP_POPUP" && activeOffers.length > 0) {
                  setPopupType("OFFERS");
                } else {
                  setShowPopup(false);
                }
              }}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>

              {popupType === "APP_POPUP" ? (
                <View>
                  <FlatList
                    ref={popupSliderRef}
                    data={appPopups}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => setPopupIndex(Math.round(e.nativeEvent.contentOffset.x / POPUP_WIDTH))}
                    renderItem={({ item }) => (
                      <View style={{ width: POPUP_WIDTH }}>
                        {item.image_url ? <Image source={{ uri: item.image_url }} style={popupStyles.appImage} /> : <View style={[popupStyles.appImage, { backgroundColor: theme.surfaceVariant }]} />}
                        <View style={popupStyles.appContent}>
                          <Text style={[popupStyles.appTitle, { color: theme.text }]}>{item.title}</Text>
                          {item.description && <Text style={[popupStyles.appDesc, { color: theme.textLight }]}>{item.description}</Text>}
                        </View>
                      </View>
                    )}
                  />
                  {appPopups.length > 1 && (
                    <View style={popupStyles.dotsRow}>
                      {appPopups.map((_, i) => <View key={i} style={[popupStyles.pDot, i === popupIndex && { backgroundColor: theme.primary, width: 18 }]} />)}
                    </View>
                  )}
                </View>
              ) : (
                <View style={popupStyles.offersView}>
                  <View style={[popupStyles.offHeader, { backgroundColor: theme.primary }]}>
                    <Text style={popupStyles.offHeaderText}>🎉 Special Offers</Text>
                  </View>
                  {activeOffers.map((off, i) => (
                    <Pressable
                      key={i}
                      style={[popupStyles.offItem, { borderBottomColor: theme.border }]}
                      onPress={async () => {
                        setShowPopup(false);
                        const matchingSvc = services.find((s) => s.title === off.title);
                        if (matchingSvc) {
                          await setClaimedOffer({
                            type: "GENERIC_OFFER",
                            serviceId: matchingSvc.id,
                            serviceTitle: matchingSvc.title,
                            offerPercentage: off.offer_percentage || 40,
                            offerPrice: (off as any).offer_price || (off as any).fixed_price,
                            claimedAt: new Date().toISOString(),
                          });
                          navigation.navigate("ServiceDetail", { service: matchingSvc });
                        }
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={popupStyles.offType}>{off.service_type}</Text>
                        <Text style={[popupStyles.offTitle, { color: theme.text }]}>{off.title}</Text>
                      </View>
                      <View style={[popupStyles.offBadge, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}>
                        <Text style={{ color: theme.primary, fontWeight: '800' }}>{off.offer_percentage}% OFF</Text>
                      </View>
                    </Pressable>
                  ))}
                  <Pressable style={[popupStyles.footerBtn, { backgroundColor: theme.primary }]} onPress={() => setShowPopup(false)}><Text style={{ fontWeight: '700' }}>Browse Services</Text></Pressable>
                </View>
              )}
            </Pressable>
          </AnimatedGradientBorder>
        </Pressable>
      </Modal>



      {/* Welcome Reward Popup */}
      <Modal visible={showWelcomePopup} transparent animationType="slide" onRequestClose={() => setShowWelcomePopup(false)}>
        <Pressable style={popupStyles.overlay} onPress={() => setShowWelcomePopup(false)}>
          <View style={[popupStyles.welcomeCard, { backgroundColor: theme.background }]}>
            <View style={popupStyles.rewardIconContainer}>
              <Ionicons name="gift" size={50} color={COLORS.saffron} />
            </View>
            <Text style={[popupStyles.welcomeTitle, { color: theme.text }]}>Welcome Reward! 🎉</Text>
            <Text style={[popupStyles.welcomeDesc, { color: theme.textLight }]}>
              Thanks for joining us! Here is your ₹50 reward for using a referral code.
            </Text>
            <View style={[popupStyles.couponBox, { backgroundColor: theme.surfaceVariant }]}>
              <Text style={[popupStyles.couponCodeText, { color: theme.text }]}>{welcomeCoupon}</Text>
              <TouchableOpacity onPress={() => {
                Clipboard.setString(welcomeCoupon);
                showToast("Code copied!", "success");
              }}>
                <Ionicons name="copy-outline" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[popupStyles.footerBtn, { backgroundColor: theme.primary, width: '100%', margin: 0, marginTop: 24 }]}
              onPress={() => setShowWelcomePopup(false)}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Great, Thanks!</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* 40% OFF Post-Signup Service Claim Popup */}
      <Modal visible={showSignupOfferPopup} transparent animationType="slide" onRequestClose={() => setShowSignupOfferPopup(false)}>
        <Pressable style={popupStyles.overlay} onPress={() => setShowSignupOfferPopup(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={[popupStyles.signupCard, { backgroundColor: theme.background }]}>

            {/* Header Row */}
            <View style={popupStyles.signupHeaderRow}>
              <View style={[popupStyles.offerBadgeTag, { backgroundColor: COLORS.saffron + "20", borderColor: COLORS.saffron }]}>
                <Ionicons name="sparkles" size={16} color={COLORS.saffron} />
                <Text style={[popupStyles.offerBadgeText, { color: COLORS.saffron }]}>40% OFF UNLOCKED</Text>
              </View>
              <Pressable onPress={() => setShowSignupOfferPopup(false)} style={[popupStyles.iconCloseBtn, { backgroundColor: theme.surfaceVariant || "#F0F0F0" }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            {/* Icon Banner */}
            <View style={popupStyles.giftIconContainer}>
              <Ionicons name="sparkles-sharp" size={42} color={COLORS.saffron} />
            </View>

            {/* Title */}
            <Text style={[popupStyles.signupModalTitle, { color: theme.text }]}>
              Claim Your 40% OFF! 🎉
            </Text>

            {/* Selected Service Highlight Box */}
            <View style={[popupStyles.serviceHighlightCard, { backgroundColor: theme.surfaceVariant || "#F8FAFC", borderColor: theme.primary + "40" }]}>
              <Text style={[popupStyles.serviceHighlightLabel, { color: theme.textLight }]}>
                Selected Service Discount:
              </Text>
              <Text style={[popupStyles.serviceHighlightTitle, { color: theme.primary }]}>
                {signupOfferInfo?.title || "Selected Service"}
              </Text>
              <View style={[popupStyles.discountPill, { backgroundColor: theme.primary }]}>
                <Text style={popupStyles.discountPillText}>40% OFF Discount Active</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[popupStyles.signupPrimaryBtn, { backgroundColor: theme.primary, marginTop: 10 }]}
              onPress={handleGoToSignupService}
              activeOpacity={0.85}
            >
              <Text style={popupStyles.signupPrimaryBtnText}>
                Claim Offer
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[popupStyles.signupSecondaryBtn, { borderColor: theme.border || "#E2E8F0" }]}
              onPress={() => setShowSignupOfferPopup(false)}
              activeOpacity={0.7}
            >
              <Text style={[popupStyles.signupSecondaryBtnText, { color: theme.textLight }]}>
                Browse Services
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Promotional Banner Selected Service Modal */}
      <Modal visible={showServiceSelectModal} transparent animationType="slide" onRequestClose={() => setShowServiceSelectModal(false)}>
        <Pressable style={popupStyles.overlay} onPress={() => setShowServiceSelectModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={[sheetStyles.sheetContainer, { backgroundColor: theme.background, position: 'absolute', bottom: 0, width: '100%', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>Special Offer</Text>
              <Pressable onPress={() => setShowServiceSelectModal(false)} style={[popupStyles.iconCloseBtn, { backgroundColor: theme.surfaceVariant || "#F0F0F0" }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 14, color: theme.textLight, marginBottom: 20 }}>Select a service to use this offer. Only ONE service can be selected.</Text>

            {loadingPromoServices ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ marginTop: 12, color: theme.textLight }}>Loading services...</Text>
              </View>
            ) : promoBannerServices.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ color: theme.textLight }}>No services available for this offer.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: height * 0.4, marginBottom: 20 }}>
                {promoBannerServices.map((svc) => {
                  const isSelected = selectedPromoServiceId === svc.id;
                  return (
                    <TouchableOpacity
                      key={svc.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderWidth: 1,
                        borderColor: isSelected ? theme.primary : (theme.border || "#E2E8F0"),
                        borderRadius: 12,
                        marginBottom: 10,
                        backgroundColor: isSelected ? theme.primary + "10" : "transparent"
                      }}
                      onPress={() => setSelectedPromoServiceId(svc.id)}
                      activeOpacity={0.7}
                    >
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: isSelected ? theme.primary : "#CBD5E1",
                        marginRight: 12,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary }} />}
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '500', color: theme.text }}>{svc.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 'auto' }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.border || "#E2E8F0", alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setShowServiceSelectModal(false)}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textLight }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: selectedPromoServiceId ? theme.primary : "#E2E8F0",
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onPress={handleSelectedServiceClaim}
                disabled={!selectedPromoServiceId || loadingPromoServices}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: selectedPromoServiceId ? "#FFFFFF" : "#94A3B8" }}>Claim Offer</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating Go Up Button */}

      {showGoUp && (
        <TouchableOpacity
          style={[goUpStyles.goUpBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up" size={24} color={COLORS.saffron} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  homeSearchContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  homeSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  dots: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  titleBar: { width: 4, height: 22, backgroundColor: COLORS.saffron, borderRadius: 2 },
  titleText: { fontSize: 20, fontWeight: "800" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginLeft: 16, marginTop: 24, marginBottom: 16 },
  gridContainer: { paddingHorizontal: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridItem: { width: "33.33%", alignItems: "center", marginBottom: 20, paddingHorizontal: 4 },
  gridItemActive: { opacity: 0.7 },
  gridIconContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#F5F7FA",
    overflow: "hidden", // Ensures image stays within rounded corners
  },
  gridIcon: { width: "85%", height: "85%" },
  gridLabel: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 18 },
});

const popupStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  container: { borderRadius: 20, overflow: "hidden" },
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 20, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 20, padding: 4 },
  appImage: { width: "100%", height: 200 },
  appContent: { padding: 20, alignItems: "center" },
  appTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  appDesc: { fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 18 },
  dotsRow: { flexDirection: "row", justifyContent: "center", paddingBottom: 16, gap: 6 },
  pDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ccc" },
  offersView: { width: "100%" },
  offHeader: { padding: 16, alignItems: "center" },
  offHeaderText: { fontSize: 18, fontWeight: "800", color: "#000" },
  offItem: { flexDirection: "row", padding: 16, borderBottomWidth: 1, alignItems: "center" },
  offType: { fontSize: 10, color: "#999", fontWeight: "700" },
  offTitle: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  offBadge: { padding: 6, borderRadius: 8, borderWidth: 1 },
  footerBtn: { margin: 16, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  welcomeCard: {
    width: "85%",
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  rewardIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(244, 196, 48, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  welcomeDesc: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  couponBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: 16,
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 2,
    borderColor: COLORS.saffron,
  },
  couponCodeText: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1,
  },
  signupCard: {
    width: "88%",
    padding: 22,
    borderRadius: 24,
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  signupHeaderRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  offerBadgeTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  offerBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  iconCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  giftIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(244, 196, 48, 0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  signupModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
  },
  serviceHighlightCard: {
    width: "100%",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 14,
  },
  serviceHighlightLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  serviceHighlightTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  discountPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  signupModalDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  signupPrimaryBtn: {
    flexDirection: "row",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    elevation: 2,
  },
  signupPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  signupSecondaryBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  signupSecondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    width: "100%",
    maxHeight: height * 0.85,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 20,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: 10,
  },
  categoryItem: {
    width: "25%",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  categoryIconContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 16,
  },
  categoryImage: {
    width: "70%",
    height: "70%",
  },
});

const goUpStyles = StyleSheet.create({
  goUpBtn: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
});

const promoBannerStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    overflow: "hidden",
    alignItems: "center",
  },
  leftContent: {
    flex: 0.65,
    justifyContent: "center",
  },
  discountText: {
    color: "#FFC928",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 0,
    letterSpacing: -0.5,
  },
  subTitleText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  descriptionText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "500",
    lineHeight: 14,
    marginBottom: 6,
  },
  claimBtn: {
    backgroundColor: "#FFC928",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
  },
  claimBtnText: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 10,
  },
  bannerImage: {
    width: "40%",
    height: "120%",
    position: "absolute",
    right: -10,
    bottom: -10,
  },
  tagContainer: {
    position: "absolute",
    top: 0,
    right: 12,
    backgroundColor: "#FFC928",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: "center",
    zIndex: 10,
  },
  tagText: {
    color: "#0F172A",
    fontSize: 7,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 9,
  }
});











