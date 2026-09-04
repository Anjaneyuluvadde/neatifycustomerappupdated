
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedGradientBorder from "../components/AnimatedGradientBorder";
import AnimatedProcessTimeline from "../components/AnimatedProcessTimeline";
import DescriptionCard from "../components/DescriptionCard";
import FAQAccordion from "../components/FAQAccordion";
import ServiceEquipmentSection from "../components/ServiceEquipmentSection";
import ServiceHowItWorksVideos from "../components/ServiceHowItWorksVideos";
import SimilarServices from "../components/SimilarServices";
import WorkIncludesCard from "../components/WorkIncludesCard";
import WorkNotIncludesCard from "../components/WorkNotIncludesCard";
import { getEquipmentForService } from "../data/serviceEquipment";
import { applyCartRules, useBookingCart } from "../context/BookingCartContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";
import { supabase } from "../lib/supabase";
import { RootStackParamList, SelectedService } from "../navigation/AppNavigator";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

/* ================= TYPES ================= */

type Props = {
  route: RouteProp<RootStackParamList, "ServiceDetail">;
};

// We need a local type for the fetched service to match what we use in state
// or we can just use the Service type if it matches well enough.
// The Service type has optional fields, so it should be fine.



type AddOn = {
  id: string;
  title: string;
  duration: number; // integer in db
  price: string; // text with ₹ symbol from db
  image?: string | null;
  service_type?: string;
  description?: string;
  sort_order?: number;
  original_price?: string | null; // text with ₹ symbol from db
  discount_percent?: number | null;
  work_includes?: string | null; // text in db (was text[], now text)
  work_not_included?: string | null; // text in db
  discount_label?: string | null;
  tax_percent?: number | null;
  max_quantity?: number | null; // max times this addon can be added (from db)
  is_active?: boolean; // only show addon if true
};

/**
 * Parse text that may be in PostgreSQL array format {"item1","item2"} or newline-separated text.
 * Returns an array of individual items.
 */
const parseTextList = (text: string): string[] => {
  const trimmed = text.trim();
  // Check for PostgreSQL array format: {"item1","item2"}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
      .slice(1, -1) // Remove outer braces
      .split(/",\s*"/)
      .map((s) => s.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }
  // Otherwise, split by newlines
  return trimmed
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
};

/* ================= COMPONENT ================= */

export default function ServiceDetailScreen({ route }: Props) {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const { checkAuth } = useAuthGuard();
  const insets = useSafeAreaInsets();
  const bottomNavPadding = useBottomNavPadding();
  const { service: paramService, serviceId } = route.params;

  const [service, setService] = useState<Service | null>(paramService || null);
  const [loadingService, setLoadingService] = useState(!paramService && !!serviceId);
  const [refreshing, setRefreshing] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const addonsTouchY = useRef(0);

  // const [showAddService, setShowAddService] = useState(false); // Removed as per request to replace
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [selectedAddonDetail, setSelectedAddonDetail] = useState<AddOn | null>(
    null
  );

  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const { cartItems: selectedServices, addService: addToGlobalCart, removeService, updateQuantity } = useBookingCart();
  const [addons, setAddons] = useState<AddOn[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(true);

  // ✅ Active offer from offers table
  const [activeOfferPercent, setActiveOfferPercent] = useState<number | null>(null);

  // ✅ Active FAQ State
  const [activeFaqId, setActiveFaqId] = useState<number>(1);


  /* ✅ PRICE FORMATTER */
  const formatPrice = (value: any) => {
    if (value === null || value === undefined) return "";
    return value
      .toString()
      .replace(/^₹\s*/, "")
      .replace(/,/g, "");
  };

  /* ✅ Convert to "₹799" style always */
  const displayRupee = (value: any) => {
    const cleaned = formatPrice(value);
    if (!cleaned) return "";
    return `₹${Number(cleaned).toLocaleString("en-IN")}`;
  };

  /* ✅ Dynamic Offer Badge Text */
  const offerBadgeText = (discount_percent: any, percentText?: any) => {
    if (percentText) return percentText;
    if (discount_percent && Number(discount_percent) > 0) {
      return `${discount_percent}% off`;
    }
    return t("serviceDetail.specialOffer");
  };



  /* ✅ Category-specific FAQs resolver */
  const getServiceSpecificFAQs = () => {
    const mainServiceType = service?.service_type?.toUpperCase() || '';
    const title = service?.title?.toUpperCase() || '';

    if (mainServiceType.includes("BATHROOM") || title.includes("BATHROOM")) {
      return [
        {
          id: 1,
          question: "How long does bathroom cleaning take?",
          answer: "It usually takes 1 to 1.5 hours per bathroom, depending on the size and current condition."
        },
        {
          id: 2,
          question: "Do you clean wall tiles and exhaust fans?",
          answer: "Yes, wall tile scrubbing, exhaust fan cleaning, taps descaling, and toilet sanitization are all fully included."
        },
        {
          id: 3,
          question: "Will hard water stains be completely removed?",
          answer: "We use premium descaling agents to remove up to 90% of hard water stains from tiles, glass surfaces, and taps."
        },
        {
          id: 4,
          question: "Do I need to provide cleaning materials?",
          answer: "No, our professionals bring all necessary materials, including specialized liquids and scrubs, at no extra cost."
        }
      ];
    }

    if (mainServiceType.includes("KITCHEN") || title.includes("KITCHEN")) {
      return [
        {
          id: 1,
          question: "Is chimney cleaning included in the service?",
          answer: "Yes, kitchen deep cleaning includes chimney filter degreasing and exhaust fan cleaning."
        },
        {
          id: 2,
          question: "Will you clean inside the cabinets?",
          answer: "We clean inside cabinets if they are emptied prior to the service. Outer surfaces are cleaned by default."
        },
        {
          id: 3,
          question: "How long does kitchen deep cleaning take?",
          answer: "A standard kitchen deep cleaning takes around 2 to 3 hours to complete thoroughly."
        },
        {
          id: 4,
          question: "Do you remove tough oil and grease stains?",
          answer: "Yes, we use specialized grease-dissolving agents to scrub hobs, countertops, and tiles."
        }
      ];
    }

    if (mainServiceType.includes("DEEP") || mainServiceType.includes("CLEANING") || title.includes("DEEP") || title.includes("CLEANING")) {
      return [
        {
          id: 1,
          question: "What is included in Full Home Deep Cleaning?",
          answer: "It includes deep cleaning of bedrooms, bathrooms, kitchen, balcony, windows, floor scrubbing, and dusting of all furniture."
        },
        {
          id: 2,
          question: "How many professionals will come for deep cleaning?",
          answer: "Depending on the size of your home (BHK), a team of 2 to 4 trained professionals will be assigned."
        },
        {
          id: 3,
          question: "How long does full home deep cleaning take?",
          answer: "It typically takes 4 to 6 hours depending on the BHK configuration and current dirt level of the house."
        },
        {
          id: 4,
          question: "Is sofa and carpet shampooing included?",
          answer: "Sofa and carpet dry vacuuming is included, but shampooing is available as a separate add-on package."
        }
      ];
    }

    if (mainServiceType.includes("BALCONY") || title.includes("BALCONY")) {
      return [
        {
          id: 1,
          question: "Will you clean the sliding glass tracks?",
          answer: "Yes, we scrub and clean sliding tracks along with glass door panels."
        },
        {
          id: 2,
          question: "Do you remove hard water spots from balcony glass?",
          answer: "Yes, we use special descaling solutions to clean balcony glasses and panels."
        },
        {
          id: 3,
          question: "How long does balcony cleaning take?",
          answer: "A typical balcony cleaning takes about 30 to 45 minutes."
        },
        {
          id: 4,
          question: "Will pigeon droppings be cleared?",
          answer: "Yes, we scrape, scrub, and sanitize areas affected by bird droppings."
        }
      ];
    }

    // Fallback for Sofa, Carpet, Appliance, etc.
    return [
      {
        id: 1,
        question: "How long does it take for a sofa to dry after shampooing?",
        answer: "It typically takes 3 to 5 hours to dry completely under a ceiling fan."
      },
      {
        id: 2,
        question: "Are the cleaning chemicals safe for kids and pets?",
        answer: "Yes, we use eco-friendly, non-toxic, and certified cleaning agents that are safe for everyone."
      },
      {
        id: 3,
        question: "How frequently should I get deep cleaning done?",
        answer: "We recommend booking a deep cleaning every 6 months to maintain hygiene and fabric fresh feel."
      },
      {
        id: 4,
        question: "Can I cancel or reschedule my booking?",
        answer: "Yes, you can easily reschedule or cancel your booking for free up to 2 hours before the scheduled time slot."
      }
    ];
  };


  /* ================= FETCH SERVICES & ADDONS ================= */

  const fetchAddons = useCallback(async () => {
    setLoadingAddons(true);
    // Fetch Services (keeping existing logic though Add Another Service is removed from UI, might be useful later)
    const { data: servicesData } = await supabase
      .from("services")
      .select(
        "id, title, service_type, main_category_id, duration, price, original_price, discount_percent, discount_label, tax_percent, image, sort_order, description, gallery_images, work_not_included"
      );
    if (servicesData) setAvailableServices(servicesData as Service[]);

    // Fetch Add-ons (only active ones)
    const { data: addonsData, error } = await supabase
      .from("add_ons")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) console.error("Error fetching addons:", error);
    if (addonsData) setAddons(addonsData as AddOn[]);
    setLoadingAddons(false);
  }, []);

  const fetchServiceDetails = useCallback(async () => {
    if (!service && serviceId) {
      setLoadingService(true);

      const fetchBySlug = async () => {
        const { data, error } = await supabase
          .from("services")
          .select(
            "id, slug, title, service_type, main_category_id, duration, price, original_price, discount_percent, discount_label, tax_percent, image, sort_order, description, gallery_images, work_includes, work_not_included"
          )
          .eq("slug", serviceId)
          .maybeSingle();
        return { data, error };
      };

      const fetchById = async () => {
        const { data, error } = await supabase
          .from("services")
          .select(
            "id, slug, title, service_type, main_category_id, duration, price, original_price, discount_percent, discount_label, tax_percent, image, sort_order, description, gallery_images, work_includes, work_not_included"
          )
          .eq("id", serviceId)
          .maybeSingle();
        return { data, error };
      };

      // Try slug first
      let { data, error } = await fetchBySlug();

      // If no data (and no breaking error), try ID
      if (!data) {
        const fallback = await fetchById();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error("Error fetching service details:", error);
      }
      if (data) {
        setService(data as Service);
      }
      setLoadingService(false);
    }
  }, [service, serviceId]);

  const fetchActiveOffer = useCallback(async (currentService: Service | null) => {
    if (!currentService) return;

    // Session-claimed offers are now applied as coupons at checkout.

    const { data: offerData } = await supabase
      .from("offers")
      .select("offer_percentage")
      .eq("title", currentService.title)
      .eq("is_offer_enabled", true)
      .maybeSingle();

    if (offerData && offerData.offer_percentage > 0) {
      setActiveOfferPercent(offerData.offer_percentage);
    } else {
      setActiveOfferPercent(null);
    }
  }, []);

  useEffect(() => {
    fetchAddons();
  }, [fetchAddons]);

  useEffect(() => {
    fetchServiceDetails();
  }, [fetchServiceDetails]);

  useEffect(() => {
    fetchActiveOffer(service);
  }, [service, fetchActiveOffer]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAddons(),
      fetchServiceDetails(),
      fetchActiveOffer(service)
    ]);
    setRefreshing(false);
  };

  /* ================= HELPERS ================= */

  const handleBookNow = async () => {
    if (loadingAddons) return;
    if (!service) return;

    let effectivePrice = service.price;
    let effectiveLabel = (service as any)?.discount_label ?? null;
    let effectiveOriginalPrice = (service as any)?.original_price ?? null;
    let effectiveDiscountPercent = (service as any)?.discount_percent ?? null;

    if (activeOfferPercent && activeOfferPercent > 0) {
      effectiveLabel = `${activeOfferPercent}% OFF`;
      effectiveDiscountPercent = activeOfferPercent;
    }

    const existing = selectedServices.find(s => s.id === service.id);

    let nextServices = [...selectedServices];

    const serviceToAdd = {
      id: service.id,
      title: service.title,
      duration: service.duration,
      price: effectivePrice,
      service_type: service.service_type,
      original_price: effectiveOriginalPrice,
      discount_percent: effectiveDiscountPercent,
      discount_label: effectiveLabel,
      tax_percent: (service as any)?.tax_percent || undefined,
      image: ((service as any)?.image as string) || undefined,
      quantity: 1,
      main_category_id: (service as any).main_category_id,
      is_addon: false,
    } as SelectedService;

    if (!existing) {
      addToGlobalCart(serviceToAdd);
      nextServices = applyCartRules(nextServices, serviceToAdd);
    }

    if (availableAddons && availableAddons.length > 0) {
      setShowAddonsModal(true);
    } else {
      const isAuth = await checkAuth("schedule an appointment");
      if (isAuth) {
        navigation.navigate("Schedule", { services: nextServices });
      }
    }
  };

  const handleShare = async () => {
    if (!service) return;
    try {
      // Use slug for cleaner links, fallback to ID
      const identifier = service.slug || service.id;
      const url = `https://www.theneatifyteam.in/service/${identifier}`;

      await Share.share({
        message: `Check out this service: ${service.title} - ${service.description?.substring(0, 100)}... \n\nBook now on The Neatify Team! \n${url}`,
        title: service.title,
        url: url, // iOS sometimes uses this field
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const addAddonToCart = (addon: AddOn) => {
    // Check if already added
    const existingAddon = selectedServices.find((s) => s.id === addon.id);

    if (existingAddon) {
      // If already added, increment quantity (up to max_quantity)
      const maxQty = addons.find((a) => a.id === addon.id)?.max_quantity || 3;
      if ((existingAddon.quantity || 1) >= maxQty) {
        return;
      }
      updateQuantity(addon.id, (existingAddon.quantity || 1) + 1);
    } else {
      // Add new addon with quantity 1
      addToGlobalCart({
        id: addon.id,
        title: addon.title,
        duration: `${addon.duration} mins`,
        price: addon.price,
        service_type: addon.service_type,
        original_price: addon.original_price,
        discount_percent: addon.discount_percent,
        discount_label: (addon as any)?.discount_label ?? null,
        tax_percent: (addon as any)?.tax_percent ?? null,
        image: addon.image || undefined,
        quantity: 1,
        is_addon: true,
      });
    }
  };

  const decrementAddon = (addonId: string) => {
    const existingAddon = selectedServices.find((s) => s.id === addonId);

    if (!existingAddon) return;

    if ((existingAddon.quantity || 1) <= 1) {
      // Remove the addon if quantity would go to 0
      removeService(addonId);
    } else {
      // Decrement quantity
      updateQuantity(addonId, (existingAddon.quantity || 1) - 1);
    }
  };

  // ✅ Filter addons to match the main service's service_type (case-insensitive)
  const availableAddons = useMemo(() => {
    const mainServiceType = service?.service_type?.toUpperCase() || '';
    return addons.filter(
      (addon) => addon.service_type?.toUpperCase() === mainServiceType
    );
  }, [addons, service]);

  const descriptionLines = useMemo(() => {
    return (service?.description || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }, [service]);

  /* ✅ PRICE UI SETTINGS */
  const hasMRP =
    (service as any)?.original_price !== null &&
    (service as any)?.original_price !== undefined &&
    Number(String((service as any)?.original_price).replace(/[^\d.]/g, '')) > 0;

  /* ================= REUSABLE PRICE ROW (EXACT LIKE SCREENSHOT) ================= */

  const PriceRow = ({
    price,
    original_price,
    discount_percent,
    percentText,
    size = "normal", // 'normal' | 'small'
  }: {
    price: any;
    original_price?: any;
    discount_percent?: any;
    percentText?: any;
    size?: "normal" | "small";
  }) => {
    // ✅ FIX: Clean prices before comparing
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
    const badgeFontSize = size === "small" ? 10 : 14; // Removed badge font size customization from props, assuming strict structure

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
        {/* ✅ MRP (STRIKE) - SHOWN FIRST */}
        {hasOld ? (
          <Text
            style={{
              fontSize: oldPriceSize,
              color: theme.textMuted,
              textDecorationLine: "line-through",
              textDecorationStyle: "solid",
              marginTop: 2,
            }}
          >
            {displayRupee(original_price)}
          </Text>
        ) : null}

        {/* ✅ OFFER PRICE (BIG) - SHOWN SECOND */}
        <Text
          style={{
            fontSize: fontSize,
            fontWeight: "800",
            color: theme.text,
          }}
        >
          {displayRupee(price)}
        </Text>

        {/* ✅ BADGE - SHOWN LAST */}
        {(percentText || discount_percent > 0) && (
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



  if (!service) {
    if (loadingService) {
      return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ padding: 16, marginTop: 40 }}>
            <View style={{ height: 250, backgroundColor: theme.surfaceVariant, borderRadius: 16, marginBottom: 16 }} />
            <View style={{ height: 32, width: '60%', backgroundColor: theme.surfaceVariant, borderRadius: 8, marginBottom: 8 }} />
            <View style={{ height: 20, width: '40%', backgroundColor: theme.surfaceVariant, borderRadius: 4 }} />
          </View>
        </View>
      );
    }
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.textLight }}>{t("serviceDetail.notFound")}</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 20, padding: 10 }}>
          <Text style={{ color: theme.primary }}>{t("serviceDetail.goBack")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? "light-content" : "dark-content"} />
      {insets.top > 0 && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: isScrolled ? theme.background : "transparent",
            zIndex: 100,
          }}
        />
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          if (y > 50) {
            setIsScrolled(true);
          } else {
            setIsScrolled(false);
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]} // Android
            tintColor={theme.primary} // iOS
            progressBackgroundColor={theme.background}
          />
        }
        contentContainerStyle={[bottomNavPadding]}
      >
        {/* BACK BUTTON */}
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate("HomeDrawer" as any);
            }
          }}
          style={{
            position: "absolute",
            top: insets.top > 0 ? insets.top + 8 : 16,
            left: 16,
            zIndex: 10,
            backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(255, 255, 255, 0.9)",
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#000"} />
        </Pressable>

        {/* SHARE BUTTON */}
        <Pressable
          onPress={handleShare}
          style={{
            position: "absolute",
            top: insets.top > 0 ? insets.top + 8 : 16,
            right: 16,
            zIndex: 10,
            backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(255, 255, 255, 0.9)",
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          <Ionicons name="share-social-outline" size={22} color={isDark ? "#fff" : "#000"} />
        </Pressable>

        {/* IMAGE */}
        <Image
          source={{ uri: service.image }}
          style={{ width: "100%", height: 280 }}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
        />

        {/* CONTENT */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: theme.text }}>
            {service.title}
          </Text>

          {/* ✅ Duration */}
          <Text style={{ marginTop: 6, color: theme.textLight, fontSize: 14 }}>
            {service.duration}
          </Text>

          {/* ✅ Exact Price Row — uses offer-overridden values if offer is active */}
          <PriceRow
            price={activeOfferPercent ? selectedServices[0]?.price ?? service.price : service.price}
            original_price={activeOfferPercent ? selectedServices[0]?.original_price : (service as any)?.original_price}
            discount_percent={activeOfferPercent ? activeOfferPercent : (service as any)?.discount_percent}
            percentText={activeOfferPercent ? `${activeOfferPercent}% OFF` : (service as any)?.discount_label}
          />

          {/* ✅ BOOK NOW */}
          <Pressable
            onPress={handleBookNow}
            disabled={loadingAddons}
            style={{
              marginTop: 20,
              backgroundColor: loadingAddons ? "#ccc" : COLORS.saffron,
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>
              {loadingAddons ? t("common.loading") : t("serviceDetail.bookNow")}
            </Text>
          </Pressable>

          <SimilarServices
            currentService={service}
            availableServices={availableServices}
          />

          <View style={{ marginTop: 24 }}>
            {/* ✅ Description */}
            <DescriptionCard description={service.description || ""} />

            {/* ✅ Work Includes */}
            <WorkIncludesCard workIncludes={service.work_includes} />

            {/* ✅ Work Not Includes */}
            <WorkNotIncludesCard workNotIncludes={service.work_not_included} />
          </View>

          {/* ✅ How it works */}
          {(() => {
            let howItWorksItems: { title: string }[] = [];

            // 1. Check if the new JSON column 'how_it_works' has data
            let parsedHowItWorks = null;
            if (service.how_it_works) {
              if (Array.isArray(service.how_it_works)) {
                parsedHowItWorks = service.how_it_works;
              } else if (typeof service.how_it_works === "string") {
                try { parsedHowItWorks = JSON.parse(service.how_it_works); } catch (e) { }
              }
            }

            if (parsedHowItWorks && Array.isArray(parsedHowItWorks) && parsedHowItWorks.length > 0) {
              // Use the new dynamic JSON column
              howItWorksItems = parsedHowItWorks.map((item: any) => {
                return {
                  title: item.title,
                };
              });
            } else {
              // 2. Legacy fallback: Use work_includes
              const workIncludesLines = service.work_includes
                ? service.work_includes
                  .replace(/\r\n/g, "\n")
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean)
                : [];

              howItWorksItems = workIncludesLines.map((line) => {
                // Strip leading bullets/dashes
                let cleanLine = line.replace(/^[•\-\*]\s*/, "");
                return {
                  title: cleanLine,
                };
              });
            }

            return howItWorksItems.length > 0 ? (
              <>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    marginTop: 30,
                    marginBottom: 20,
                    color: theme.text,
                  }}
                >
                  {t("serviceDetail.howItWorks") || "How it works"}
                </Text>

                {(() => {
                  console.log("[ServiceDetail] current service id:", service.id);
                  return null;
                })()}

                <ServiceHowItWorksVideos serviceId={service.id} />

                <AnimatedProcessTimeline steps={howItWorksItems} />
              </>
            ) : null;
          })()}

          {/* ✅ NEW SECTIONS: Trust Building */}
          <View style={{ marginTop: 32 }}>

            {/* 1. Meet Our Best Cleaners */}
            <Text style={{ fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 16 }}>
              Meet Our Best Cleaners
            </Text>
            <View style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
              borderWidth: 1, borderColor: theme.border,
              marginBottom: 32
            }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="time" size={20} color={COLORS.saffron} style={{ marginRight: 8 }} />
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>100+ Hours</Text>
                    <Text style={{ fontSize: 12, color: theme.textLight }}>Trained for 100+ hours</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="star" size={20} color={COLORS.saffron} style={{ marginRight: 8 }} />
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>4.8/5</Text>
                    <Text style={{ fontSize: 12, color: theme.textLight }}>Average customer rating</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="home" size={20} color={COLORS.saffron} style={{ marginRight: 8 }} />
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>10K+</Text>
                    <Text style={{ fontSize: 12, color: theme.textLight }}>Homes served</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.saffron} style={{ marginRight: 8 }} />
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Verified</Text>
                    <Text style={{ fontSize: 12, color: theme.textLight }}>Verified by Team Neatify</Text>
                  </View>
                </View>
              </View>
              <View style={{ width: 120, justifyContent: 'center', alignItems: 'center' }}>
                <Image
                  source={require("../../assets/images/heroimg.png")}
                  style={{ width: 120, height: 160 }}
                  contentFit="contain"
                />
              </View>
            </View>

            {/* 2. Our Cleaning Tools & Equipment */}
            {/* <ServiceEquipmentSection equipmentData={getEquipmentForService(service)} /> */}

            {/* 3. What We Need From You */}
            <Text style={{ fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 4 }}>
              What We Need From You
            </Text>
            <Text style={{ fontSize: 14, color: theme.textLight, marginBottom: 16 }}>
              A few simple things to help us get started
            </Text>
            <View style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1, borderColor: theme.border,
              shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
              marginBottom: 32
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ marginRight: 12 }}>
                  <MaterialCommunityIcons name="bucket-outline" size={28} color={theme.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Bucket & Water</Text>
                  <Text style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>Keep sufficient water ready</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ marginRight: 12 }}>
                  <MaterialCommunityIcons name="power-plug-outline" size={28} color={theme.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Power Point</Text>
                  <Text style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>Provide access when needed</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ marginRight: 12 }}>
                  <MaterialCommunityIcons name="ladder" size={28} color={theme.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>Ladder / Stool</Text>
                  <Text style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>Keep a safe one available</Text>
                </View>
              </View>
            </View>

            {/* 4. Customer Rating */}
            <Text style={{ fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 16 }}>
              What Our Customers Say
            </Text>
            <View style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 24,
              alignItems: 'center',
              borderWidth: 1, borderColor: theme.border,
              shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
              marginBottom: 32
            }}>
              <Text style={{ fontSize: 42, fontWeight: '900', color: theme.text, marginBottom: 4 }}>4.8<Text style={{ fontSize: 24, color: theme.textLight }}>/5</Text></Text>
              <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((_, i) => (
                  <Ionicons key={i} name="star" size={24} color={COLORS.saffron} style={{ marginHorizontal: 2 }} />
                ))}
              </View>
              <Text style={{ fontSize: 14, color: theme.textLight, fontWeight: '500' }}>Based on customer reviews</Text>
            </View>

          </View>

          {/* ✅ FAQs Section */}
          {(() => {
            const faqs = getServiceSpecificFAQs();

            return (
              <View style={{ marginTop: 24, paddingBottom: 16 }}>
                {/* FAQ Badge */}
                <View
                  style={{
                    backgroundColor: isDark ? "rgba(244, 196, 48, 0.15)" : "#FDFCE8",
                    borderColor: "rgba(244, 196, 48, 0.3)",
                    borderWidth: 1,
                    borderRadius: 100,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    alignSelf: "flex-start",
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#D97706",
                      fontSize: 11,
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                    }}
                  >
                    FAQs
                  </Text>
                </View>

                {/* FAQ Title */}
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: theme.text,
                    marginBottom: 6,
                  }}
                >
                  Frequently Asked{" "}
                  <Text style={{ color: COLORS.saffron }}>Questions</Text>
                </Text>

                <Text
                  style={{
                    fontSize: 14,
                    color: theme.textLight,
                    marginBottom: 20,
                    lineHeight: 20,
                  }}
                >
                  Find answers to common questions about our {service?.title || "service"}.
                </Text>

                <FAQAccordion faqs={faqs} />
              </View>
            );
          })()}
        </View>


        {/* ================= ADDONS LIST MODAL ================= */}
        <Modal visible={showAddonsModal} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => { setShowAddonsModal(false); }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "bottom"]}>
            <View
              style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 20, alignItems: "center", justifyContent: "center" }}
              onTouchStart={(e) => addonsTouchY.current = e.nativeEvent.pageY}
              onTouchEnd={(e) => {
                if (e.nativeEvent.pageY - addonsTouchY.current > 80) {
                  setShowAddonsModal(false);
                }
              }}
            >
              <AnimatedGradientBorder
                borderRadius={20}
                borderWidth={2}
                animationSpeed={3}
                style={{ width: "100%", maxHeight: "85%" }}
              >
                <View style={{ backgroundColor: theme.background, borderRadius: 20, width: "100%", maxHeight: "100%", overflow: "hidden" }}>
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
                    <Text style={{ fontSize: 20, fontWeight: "800", color: theme.text }}>{t("serviceDetail.addOns")}</Text>
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
                    onScroll={(e) => {
                      if (e.nativeEvent.contentOffset.y < -60) {
                        setShowAddonsModal(false);
                      }
                    }}
                    onScrollEndDrag={(e) => {
                      if (e.nativeEvent.contentOffset.y <= 0 && e.nativeEvent.velocity && e.nativeEvent.velocity.y > 1.5) {
                        setShowAddonsModal(false);
                      }
                    }}
                    scrollEventThrottle={16}
                  >
                    {availableAddons.length === 0 ? (
                      <Text style={{ textAlign: "center", marginTop: 20, color: theme.textLight }}>
                        {t("serviceDetail.noAddons")}
                      </Text>
                    ) : (
                      availableAddons.map((addon) => {
                        const isAdded = selectedServices.some(
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
                                  resizeMode="cover"
                                />
                              ) : (
                                <View
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: theme.surfaceVariant,
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text style={{ color: theme.textLight, fontSize: 10 }}>{t("serviceDetail.noImage")}</Text>
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
                                  {addon.price}
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
                                      backgroundColor: theme.surfaceVariant,
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
                                      {selectedServices.find((s) => s.id === addon.id)?.quantity || 1}
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
                                      disabled={(selectedServices.find((s) => s.id === addon.id)?.quantity || 1) >= (addon.max_quantity || 3)}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 20,
                                          fontWeight: "700",
                                          color: (selectedServices.find((s) => s.id === addon.id)?.quantity || 1) >= (addon.max_quantity || 3) ? theme.textLight : theme.text
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

                  {/* Continue Button */}
                  <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
                    <Pressable
                      onPress={async () => {
                        const isAuth = await checkAuth("schedule an appointment");
                        if (isAuth) {
                          setShowAddonsModal(false);
                          navigation.navigate("Schedule", { services: selectedServices });
                        }
                      }}
                      style={{
                        backgroundColor: COLORS.saffron,
                        paddingVertical: 14,
                        borderRadius: 10,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "#000", fontWeight: "800", fontSize: 16 }}>
                        Continue →
                      </Text>
                    </Pressable>
                  </View>
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
              onTouchStart={(e) => addonsTouchY.current = e.nativeEvent.pageY}
              onTouchEnd={(e) => {
                if (e.nativeEvent.pageY - addonsTouchY.current > 80) {
                  setSelectedAddonDetail(null);
                }
              }}
            >
              <AnimatedGradientBorder
                borderRadius={20}
                borderWidth={2}
                animationSpeed={3}
                style={{ flex: 1 }}
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
                    onScroll={(e) => {
                      if (e.nativeEvent.contentOffset.y < -60) {
                        setSelectedAddonDetail(null);
                      }
                    }}
                    onScrollEndDrag={(e) => {
                      if (e.nativeEvent.contentOffset.y <= 0 && e.nativeEvent.velocity && e.nativeEvent.velocity.y > 1.5) {
                        setSelectedAddonDetail(null);
                      }
                    }}
                  >
                    {/* Full Image */}
                    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                      {selectedAddonDetail.image && selectedAddonDetail.image.trim() !== '' ? (
                        <Image
                          source={{ uri: selectedAddonDetail.image }}
                          style={{ width: "100%", height: 280, borderRadius: 16 }}
                          resizeMode="cover"
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
                          <Text style={{ color: theme.textLight }}>{t("serviceDetail.noImage")}</Text>
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
                    />

                    {/* Action Button */}
                    {selectedServices.find(
                      (s) => s.id === selectedAddonDetail.id
                    ) ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: theme.surfaceVariant,
                          borderRadius: 10,
                          paddingHorizontal: 20,
                          paddingVertical: 14,
                          marginTop: 15,
                        }}
                      >
                        <Pressable
                          onPress={() => decrementAddon(selectedAddonDetail.id)}
                          style={{
                            paddingHorizontal: 20,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={{ fontSize: 24, fontWeight: "700", color: theme.text }}>
                            -
                          </Text>
                        </Pressable>

                        <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>
                          {selectedServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1}
                        </Text>

                        <Pressable
                          onPress={() => addAddonToCart(selectedAddonDetail)}
                          style={{
                            paddingHorizontal: 20,
                            paddingVertical: 8,
                          }}
                          disabled={(selectedServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1) >= 3}
                        >
                          <Text
                            style={{
                              fontSize: 24,
                              fontWeight: "700",
                              color: (selectedServices.find((s) => s.id === selectedAddonDetail.id)?.quantity || 1) >= 3 ? theme.textLight : theme.text
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
                        <Text
                          style={{
                            color: "#000",
                            fontWeight: "800",
                            fontSize: 16,
                          }}
                        >
                          + Add
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </AnimatedGradientBorder>
            </View>
          </Modal>
        )}

      </ScrollView>
    </View>
  );
}

