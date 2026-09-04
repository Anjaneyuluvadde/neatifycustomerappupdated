import { Ionicons } from "@expo/vector-icons";
import { DrawerActions, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutAnimation, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from "react-native";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { supabase } from "../lib/supabase";
import LocationService from "../services/LocationService";

type HeaderProps = {
  isCurved?: boolean;
};

export default function Header({ isCurved = false }: HeaderProps) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { checkAuth } = useAuthGuard();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();

  const isHome = route.name.toLowerCase().includes('home');

  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);
  const [locationName, setLocationName] = useState<string>("Fetching location...");
  const [fullAddress, setFullAddress] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const greetingOpacity = useRef(new Animated.Value(0)).current;
  const greetingTranslateY = useRef(new Animated.Value(15)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(greetingOpacity, {
        toValue: 1,
        duration: 300,
        delay: 0,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(greetingTranslateY, {
        toValue: 0,
        duration: 300,
        delay: 0,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    handleRefresh(true);

    return () => subscription.unsubscribe();
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Silently refresh location when returning to the screen
      handleRefresh(false, true);
    }, [])
  );

  const startSpin = () => {
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopSpin = () => {
    spinValue.stopAnimation();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleRefresh = async (isInitial = false, isSilent = false) => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    if (!isSilent) startSpin();

    const oldLocation = locationName;
    if (!isSilent) setLocationName("Fetching location...");

    try {
      if (isInitial) {
        console.log("[LOCATION STEP 1] App location initialization started");
        console.log("[LOCATION STEP 1] Requesting fresh device GPS");
      }

      // Force GPS on initial load by passing `isInitial` as `forceGPS`
      const result = await LocationService.fetchCurrentLocation(undefined, isInitial);

      if (result.status === 'permission_denied' || result.status === 'services_disabled') {
        if (isInitial) console.log("[LOCATION STEP 1] GPS FAILED");
        setLocationName(result.status === 'permission_denied' ? "Permission denied" : "Location services disabled");
        return;
      }

      if (result.status === 'unserviceable') {
        if (isInitial) console.log("[LOCATION STEP 1] GPS FAILED");
        navigation.reset({
          index: 0,
          routes: [{ name: "ComingSoon" }]
        });
        return;
      }

      if (result.status === 'error') {
        if (isInitial) console.log("[LOCATION STEP 1] GPS FAILED");
        setLocationName("Unable to update location");
        if (!isInitial && oldLocation !== "Fetching location..." && oldLocation !== "Unable to update location") {
          setTimeout(() => setLocationName(oldLocation), 2500);
        }
        return;
      }

      // Success
      if (isInitial) {
        console.log("[LOCATION STEP 1] GPS latitude:", result.latitude);
        console.log("[LOCATION STEP 1] GPS longitude:", result.longitude);
        console.log("[LOCATION STEP 1] Reverse geocode postalCode:", result.postalCode);
        console.log("[LOCATION STEP 1] Final location pincode:", result.postalCode);

        // Update the cached/selected location state so subsequent non-forced fetches use it
        await LocationService.setSelectedLocation(result);
      }

      setLocationName(result.locality);
      setFullAddress(result.fullAddress);

    } catch (error) {
      if (isInitial) console.log("[LOCATION STEP 1] GPS FAILED");
      console.warn("Location error:", error);
      if (!isSilent) setLocationName("Unable to update location");
      setFullAddress("");
      if (!isInitial && !isSilent && oldLocation !== "Fetching location..." && oldLocation !== "Unable to update location") {
        setTimeout(() => setLocationName(oldLocation), 2500);
      }
    } finally {
      setIsRefreshing(false);
      if (!isSilent) stopSpin();
    }
  };

  const toggleLocation = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

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
      console.error('Error fetching profile for header:', error);
    }
  };

  const handleMenuPress = () => {
    const drawerNav = navigation.getParent("root-drawer") || navigation;
    drawerNav.dispatch(DrawerActions.toggleDrawer());
  };

  const userName = profile?.full_name || " ";

  if (!isHome) {
    return null;
  }

  const addressPreview = fullAddress
    ? fullAddress.split(',').slice(0, 2).join(',').substring(0, 15) + "..."
    : "";

  return (
    <View style={[styles.container, isCurved && styles.curved]}>
      {/* TOP ROW */}
      <View style={styles.topRow}>
        <View style={styles.brandContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("LocationSearch")}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#000000',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 3,
              maxWidth: '75%'
            }}
          >
            <View style={{
              backgroundColor: '#FFC928',
              padding: 6,
              borderRadius: 12,
              marginRight: 10
            }}>
              <Ionicons name="location" size={18} color="#000000" />
            </View>
            <View style={{ flexShrink: 1, flexDirection: 'column', justifyContent: 'center' }}>
              <Text
                style={{ fontSize: 15, color: '#FFFFFF', fontWeight: '700', fontFamily: 'Helvetica Neue', marginBottom: 1 }}
                numberOfLines={1}
              >
                {locationName}
              </Text>
              {fullAddress ? (
                <Text
                  style={{ fontSize: 11, color: '#CBD5E1', fontWeight: '500', fontFamily: 'Helvetica Neue' }}
                  numberOfLines={1}
                >
                  {addressPreview}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.rightActions}>
          <TouchableOpacity style={styles.profileButton} onPress={handleMenuPress}>
            <Ionicons
              name="person"
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* GREETING */}
      <Animated.View style={[styles.greetingContainer, { opacity: greetingOpacity, transform: [{ translateY: greetingTranslateY }] }]}>
        <Text style={styles.greetingWrapper}>
          <Text style={styles.helloText}>Hello, </Text>
          <Text style={styles.usernameText}>{userName}</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#FFC928",
  },
  curved: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandContainer: {
    flex: 1,
    marginRight: 12,
    justifyContent: "center",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logo: {
    width: 125,
    height: 35,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  greetingContainer: {
    marginTop: 8,
    alignItems: "flex-start",
    justifyContent: "center",
    width: "100%",
    paddingLeft: 12,
  },
  greetingWrapper: {
    textAlign: "left",
  },
  helloText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#475569",
    fontFamily: "Helvetica Neue",
  },
  usernameText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    fontFamily: "Helvetica Neue",
    letterSpacing: 0.5,
  },
});
