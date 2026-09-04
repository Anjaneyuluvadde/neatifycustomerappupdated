import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { MapPin } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import NeatifyLogo from "../../assets/images/neatifylogo.png";
import { isServiceable } from "../config/serviceAreas";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";

type LocationStatus = 'detecting' | 'checking' | 'serviceable' | 'error' | 'denied';

export default function LocationAccessScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [status, setStatus] = useState<LocationStatus>('detecting');

  // Animation values
  const pinPulse = useSharedValue(1);
  const characterBob = useSharedValue(0);

  useEffect(() => {
    // Pin pulse animation
    pinPulse.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );

    // 3D character bobbing animation (6-10px)
    characterBob.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1800 }),
        withTiming(0, { duration: 1800 })
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    // Delay the location request slightly so the user sees the branding first
    const timer = setTimeout(() => {
      checkAndRequestLocation();
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const pinAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pinPulse.value }],
    };
  });

  const characterAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: characterBob.value }],
    };
  });

  const navigateNext = async (route: "HomeDrawer" | "ComingSoon") => {
    if (route === "ComingSoon") {
      navigation.replace("ComingSoon");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Double check profile completeness
        const { data: profile } = await supabase
          .from("profile")
          .select("full_name, email, phone")
          .eq("id", session.user.id)
          .maybeSingle();

        const hasFullProfile = !!(profile?.full_name && profile.full_name.trim().length > 0);
        if (!hasFullProfile) {
          const rawPhone = profile?.phone || session.user.phone || session.user.user_metadata?.phone_number || "";
          const digits = rawPhone.replace(/\D/g, "").slice(-10);
          navigation.replace("CompleteProfile", { initialData: { phone: digits } });
          return;
        }
      }
      navigation.replace("HomeDrawer");
    } catch (err) {
      console.error("Error checking session during location navigation:", err);
      navigation.replace("HomeDrawer"); // Fallback to Home as Guest
    }
  };

  const checkAndRequestLocation = async () => {
    setStatus('detecting');
    try {
      // Check current permission status
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        // Automatically request permission if not granted
        const { status: requestedStatus } = await Location.requestForegroundPermissionsAsync();
        finalStatus = requestedStatus;
      }

      if (finalStatus !== 'granted') {
        setStatus('denied');
        return;
      }

      setStatus('checking');

      // Automatically get high accuracy location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      // Validation check
      if (location.coords.accuracy && location.coords.accuracy > 150) {
        console.warn("Low accuracy, might need retry.");
      }

      // Verify service area
      const serviceable = isServiceable(location.coords.latitude, location.coords.longitude);

      if (serviceable) {
        setStatus('serviceable');
        // Briefly show "You're in our service area!" before navigating
        setTimeout(() => {
          navigateNext("HomeDrawer");
        }, 1200);
      } else {
        // Not serviceable -> Coming Soon
        setTimeout(() => {
          navigateNext("ComingSoon");
        }, 800);
      }

    } catch (error) {
      console.warn("Location error:", error);
      setStatus('error');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Decorators */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.bgCircleTop} />
        <View style={styles.bgCircleBottom} />
      </View>

      <View style={[styles.content, isDesktop && styles.desktopContent]}>

        {/* LOGO */}
        <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.logoContainer}>
          <Image source={NeatifyLogo} style={styles.logo} contentFit="contain" />
        </Animated.View>

        {/* HERO SECTION */}
        <View style={styles.heroSection}>

          {/* 3D Character */}
          <Animated.View entering={FadeInDown.duration(600).delay(200)} style={characterAnimatedStyle}>
            <Image
              source={require("../../assets/images/heroimg.png")}
              style={styles.characterImage}
              contentFit="contain"
            />
          </Animated.View>

          {/* Location status UI */}
          <Animated.View entering={FadeInDown.duration(600).delay(400)} style={styles.statusContainer}>

            {(status === 'detecting' || status === 'checking') && (
              <>
                <Animated.View style={[styles.iconContainer, pinAnimatedStyle]}>
                  <View style={styles.iconGlow} />
                  <MapPin size={32} color="#111" strokeWidth={2.5} />
                </Animated.View>
                <Text style={styles.statusTitle}>
                  {status === 'detecting' ? "Finding your location..." : "Checking service availability..."}
                </Text>
                <Text style={styles.statusDesc}>
                  Getting your nearby cleaning services ready.
                </Text>
              </>
            )}

            {status === 'serviceable' && (
              <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center' }}>
                <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
                  <MapPin size={32} color="#2E7D32" strokeWidth={2.5} />
                </View>
                <Text style={[styles.statusTitle, { color: '#2E7D32' }]}>You&apos;re in our service area!</Text>
              </Animated.View>
            )}

            {status === 'error' && (
              <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center' }}>
                <Text style={styles.statusTitle}>Unable to detect your location</Text>
                <Text style={styles.statusDesc}>Please check your location settings.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={checkAndRequestLocation}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {status === 'denied' && (
              <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center' }}>
                <Text style={styles.statusTitle}>Permission Denied</Text>
                <Text style={styles.statusDesc}>Location access is needed to find nearby services.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={checkAndRequestLocation}>
                  <Text style={styles.retryText}>Retry Permission</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

          </Animated.View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  desktopContent: {
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  bgCircleTop: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.saffron + "15",
    top: -100,
    right: -100,
  },
  bgCircleBottom: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: COLORS.saffron + "10",
    bottom: -150,
    left: -150,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 10,
  },
  logo: {
    width: 140,
    height: 40,
  },
  heroSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -40,
  },
  characterImage: {
    width: 220,
    height: 200,
    marginBottom: 40,
  },
  statusContainer: {
    alignItems: "center",
    minHeight: 150,
    justifyContent: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.saffron + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    position: "relative",
  },
  iconGlow: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.saffron,
    opacity: 0.2,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
    textAlign: "center",
  },
  statusDesc: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
    paddingHorizontal: 20,
  },
  retryBtn: {
    backgroundColor: "#111",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  retryText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  }
});
