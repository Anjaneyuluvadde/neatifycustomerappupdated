import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { ChevronDown, Gift, Phone, Sparkles, User } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import NeatifyLogo from "../../assets/images/neatifylogo.png";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import TermsModal from "../components/TermsModal";
import PrivacyModal from "../components/PrivacyModal";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { COLORS } from "../theme/colors";
import { setClaimedOffer } from "../utils/priceUtils";
import { generateReferralCode, validateReferralCode } from "../utils/referralUtils";

// Animated Input Component
function AnimatedInput({ icon, placeholder, value, onChange, secureTextEntry, rightElement, keyboardType, maxLength, autoCapitalize }: any) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 250 });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(focusAnim.value, [0, 1], ["#F0F0F0", COLORS.saffron]),
      shadowOpacity: focusAnim.value * 0.1,
      shadowRadius: focusAnim.value * 6,
      shadowColor: COLORS.saffron,
      shadowOffset: { width: 0, height: 3 },
      elevation: focusAnim.value * 3,
      transform: [{ scale: 1 + focusAnim.value * 0.01 }]
    };
  });

  return (
    <Animated.View style={[styles.animatedInputContainer, animatedStyle]}>
      {icon}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#888"
        value={value}
        onChangeText={onChange}
        secureTextEntry={secureTextEntry}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
      />
      {rightElement}
    </Animated.View>
  );
}

// Custom Phone Input Component
function AnimatedPhoneInput({ value, onChangeText, theme }: any) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 250 });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(focusAnim.value, [0, 1], ["#F0F0F0", COLORS.saffron]),
      shadowOpacity: focusAnim.value * 0.1,
      shadowRadius: focusAnim.value * 6,
      shadowColor: COLORS.saffron,
      shadowOffset: { width: 0, height: 3 },
      elevation: focusAnim.value * 3,
      transform: [{ scale: 1 + focusAnim.value * 0.01 }]
    };
  });

  return (
    <Animated.View style={[styles.animatedInputContainer, animatedStyle]}>
      <Phone size={20} color="#888" />
      <Text style={{ marginLeft: 10, fontSize: 16, color: "#111", fontWeight: '600' }}>+91</Text>
      <View style={{ width: 1, height: 20, backgroundColor: "#F0F0F0", marginHorizontal: 10 }} />
      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        placeholderTextColor="#888"
        value={value}
        onChangeText={(text) => {
          let cleaned = text.replace(/\D/g, '');
          if (cleaned.startsWith('91') && cleaned.length > 10) {
            cleaned = cleaned.slice(2);
          }
          onChangeText(cleaned.slice(0, 10));
        }}
        keyboardType="phone-pad"
        maxLength={10}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </Animated.View>
  );
}


// Custom OTP Input Component
function OtpInput({ value, onChangeText, length = 6 }: any) {
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const { width } = useWindowDimensions();

  // Calculate exact cell width to prevent flex collapse on some Android devices
  // formContainer padding (24*2=48) + margin (16*2=32) = 80px total spacing
  const totalGapWidth = (length - 1) * 6;
  const availableWidth = width - 80 - totalGapWidth;
  const cellWidth = Math.max(32, Math.floor(Math.min(46, availableWidth / length)));

  const handleChange = (text: string, index: number) => {
    // Handle paste
    if (text.length > 1) {
      const pastedText = text.replace(/[^0-9]/g, '').slice(0, length);
      onChangeText(pastedText);
      if (pastedText.length > 0) {
        inputRefs.current[Math.min(pastedText.length, length - 1)]?.focus();
      }
      return;
    }

    const cleanText = text.replace(/[^0-9]/g, '');

    // If deleted via onChangeText
    if (cleanText === '') {
      const newValue = value.split('');
      newValue[index] = '';
      onChangeText(newValue.join(''));
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    const newValue = value.split('');
    newValue[index] = cleanText;
    onChangeText(newValue.join(''));

    // Auto focus next
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      // If input is ALREADY empty, onChangeText won't fire. We must handle it here.
      if (!value[index] && index > 0) {
        const newValue = value.split('');
        newValue[index - 1] = '';
        onChangeText(newValue.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <View style={{ width: '100%', alignItems: 'center', marginVertical: 10 }}>
      <View style={{ flexDirection: 'row', gap: 6, width: '100%', justifyContent: 'center' }}>
        {Array(length).fill(0).map((_, index) => (
          <View
            key={index}
            style={[
              styles.animatedInputContainer,
              {
                width: cellWidth,
                height: 48,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 0,
                paddingVertical: 0,
                borderColor: value.length === index || (index === length - 1 && value.length === length) ? COLORS.saffron : (value[index] ? COLORS.saffron + '80' : '#F0F0F0'),
                borderWidth: value.length === index || (index === length - 1 && value.length === length) ? 2 : 1.5,
              }
            ]}
          >
            <TextInput
              ref={(ref) => {
                if (ref) inputRefs.current[index] = ref;
              }}
              value={value[index] || ''}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={length}
              selectTextOnFocus
              style={{ fontSize: 24, fontWeight: '700', color: '#111', textAlign: 'center', width: '100%', height: '100%' }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// Custom Service Dropdown Component
function AnimatedServiceDropdown({ selectedService, setShowServiceDropdown }: any) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  // Animate on press in/out instead of focus since it's a touchable
  const handlePressIn = () => { focusAnim.value = withTiming(1, { duration: 200 }); }
  const handlePressOut = () => { focusAnim.value = withTiming(0, { duration: 200 }); }

  const animatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: selectedService ? COLORS.saffron : interpolateColor(focusAnim.value, [0, 1], ["#F0F0F0", COLORS.saffron]),
      transform: [{ scale: 1 - focusAnim.value * 0.02 }]
    };
  });

  return (
    <Animated.View style={[styles.animatedInputContainer, animatedStyle, { paddingVertical: 0 }]}>
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingVertical: 12 }}
        onPress={() => setShowServiceDropdown(true)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <Sparkles size={20} color={COLORS.saffron} />
        <Text style={[styles.input, { color: selectedService ? "#111" : "#888" }]} numberOfLines={1}>
          {selectedService ? selectedService.title : "Select a service for 40% OFF"}
        </Text>
        <ChevronDown size={20} color="#888" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ----------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------
export default function LoginScreen(props: any) {
  const navigation = useNavigation<any>();
  const { showAlert, showToast } = useNotification();
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [authStep, setAuthStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [termsViewed, setTermsViewed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const [eligibleServices, setEligibleServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  useEffect(() => {
    fetchEligibleServices();
  }, []);

  const fetchEligibleServices = async () => {
    try {
      let { data, error } = await supabase
        .from("services")
        .select("id, title, service_type, price, is_welcome_offer_eligible")
        .eq("is_welcome_offer_eligible", true)
        .order("sort_order", { ascending: true });

      if (error || !data || data.length === 0) {
        const { data: allServices } = await supabase
          .from("services")
          .select("id, title, service_type, price, is_welcome_offer_eligible")
          .order("sort_order", { ascending: true })
          .limit(30);
        data = allServices;
      }
      setEligibleServices(data || []);
    } catch (err) {
      console.log("Error fetching eligible services:", err);
      setEligibleServices([]);
    }
  };

  const [loading, setLoading] = useState(false);

  const checkProfileAndNavigate = async (userId: string) => {
    console.log("🚀 [Auth Debug] checkProfileAndNavigate starting for userId:", userId);
    try {
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);

      // Check if profile exists in database
      const { data: profile, error: profileFetchError } = await supabase
        .from("profile")
        .select("id, phone, full_name, email")
        .eq("id", userId)
        .maybeSingle();

      console.log("🚀 [Auth Debug] Profile query result:", { profile, profileFetchError });

      // If existing profile has a valid full_name, land directly on HomeDrawer!
      if (profile && profile.full_name && profile.full_name.trim().length > 0) {
        console.log("🚀 [Auth Debug] Existing user found:", profile.full_name, "-> Navigating to HomeDrawer");
        navigation.reset({ index: 0, routes: [{ name: "HomeDrawer" }] });
      } else {
        // New user or incomplete profile -> Navigate to CompleteProfile screen
        console.log("🚀 [Auth Debug] New user detected -> Navigating to CompleteProfile");
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "CompleteProfile",
              params: { initialData: { phone: cleanPhone } }
            }
          ]
        });
      }
    } catch (err) {
      console.error("❌ [Auth Debug] Profile check failed with exception:", err);
      navigation.reset({ index: 0, routes: [{ name: "HomeDrawer" }] });
    }
  };


  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    console.log("🚀 [Auth Debug] handleSendOtp called for phone:", cleanPhone);
    if (cleanPhone.length < 10) {
      showAlert({ type: "warning", title: "Invalid Phone", message: "Please enter a valid 10-digit phone number." });
      return;
    }
    setLoading(true);
    try {
      console.log("🚀 [Auth Debug] Invoking msg91-send-otp...");
      const { data, error } = await supabase.functions.invoke('msg91-send-otp', {
        body: { phone: cleanPhone }
      });
      console.log("🚀 [Auth Debug] msg91-send-otp response:", { data, error });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.message || data?.error || 'Failed to send OTP');
      }
      setAuthStep('otp');
      setResendTimer(60);
      showToast("OTP sent successfully");
    } catch (err: any) {
      console.error("❌ [Auth Debug] handleSendOtp error:", err);
      showAlert({ type: "error", title: "Error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    console.log("🚀 [Auth Debug] handleVerifyOtp called. OTP:", otp, "Phone:", phone);
    if (otp.length < 4) {
      showAlert({ type: "warning", title: "Invalid OTP", message: "Please enter the complete OTP." });
      return;
    }
    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      console.log("🚀 [Auth Debug] Invoking verify-otp for cleanPhone:", cleanPhone);
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone: cleanPhone, otp }
      });
      console.log("🚀 [Auth Debug] verify-otp response data:", JSON.stringify(data, null, 2));
      console.log("🚀 [Auth Debug] verify-otp response error:", error);

      if (error) {
        let realMessage = error.message;
        try {
          if (error.context && typeof error.context.json === 'function') {
            const errBody = await error.context.json();
            if (errBody?.message) realMessage = errBody.message;
            if (errBody?.error) realMessage = errBody.error;
          }
        } catch (_) {}

        if (realMessage.includes("already been verified")) {
          realMessage = "This OTP has already been used or verified. Please click 'Resend OTP' for a new code.";
        }
        throw new Error(realMessage || "Failed to verify OTP");
      }

      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Failed to verify OTP');
      }

      if (data.session) {
        console.log("🚀 [Auth Debug] Setting session in Supabase client...");
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession(data.session);
        console.log("🚀 [Auth Debug] setSession result:", { sessionData, sessionError });
      } else {
        console.warn("⚠️ [Auth Debug] No session object in verify-otp response!");
      }

      const currentUserId = data.user?.id || (await supabase.auth.getUser()).data.user?.id;
      console.log("🚀 [Auth Debug] Resolved userId for navigation:", currentUserId);

      if (!currentUserId) {
        throw new Error("Could not retrieve valid user ID after OTP verification.");
      }

      await checkProfileAndNavigate(currentUserId);
    } catch (err: any) {
      console.error("❌ [Auth Debug] handleVerifyOtp failed:", err);
      showAlert({ type: "error", title: "Verification Failed", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------
  // Animations
  // -------------------------------------
  const characterBob = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    characterBob.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1800 }),
        withTiming(0, { duration: 1800 })
      ),
      -1,
      true
    );
  }, []);

  const characterAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: characterBob.value }],
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const handlePressIn = () => { buttonScale.value = withSpring(0.96); };
  const handlePressOut = () => { buttonScale.value = withSpring(1); };

  // -------------------------------------
  // Render
  // -------------------------------------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FDFDFD" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDFDFD" />

      {/* Subtle Background Elements */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.bgCircleTop} />
        <View style={styles.bgCircleBottom} />
      </View>

      {/* BACK BUTTON */}
      <TouchableOpacity
        onPress={() => { navigation.canGoBack() ? navigation.goBack() : navigation.replace("HomeDrawer"); }}
        style={[styles.backBtn, { top: Math.max(insets.top, 10) }]}
      >
        <Ionicons name="arrow-back" size={24} color="#111" />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            isDesktop && { flexDirection: "row", alignItems: "center", justifyContent: "center" }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* DESKTOP RIGHT SIDE / MOBILE TOP: 3D Character */}
          <View style={[isDesktop ? styles.desktopCharacterContainer : styles.mobileCharacterContainer]}>
            <Animated.View style={characterAnimatedStyle}>
              <Image
                source={require("../../assets/images/heroimg.png")}
                style={isDesktop ? styles.desktopCharacterImage : styles.mobileCharacterImage}
                contentFit="contain"
              />
            </Animated.View>
          </View>

          {/* FORM CONTAINER */}
          <Animated.View
            entering={FadeInUp.duration(600).delay(100)}
            style={[styles.formContainer, isDesktop && styles.desktopFormContainer]}
          >
            <View style={styles.header}>
              <Image source={NeatifyLogo} style={styles.logo} contentFit="contain" />
              <Text style={styles.subtitle}>
                Welcome to Neatify! Ready for a sparkling clean home?
              </Text>
            </View>

            <View style={styles.form}>

              {authStep === 'phone' && (
                <Animated.View entering={FadeInDown.duration(400).delay(300)}>
                  <AnimatedPhoneInput value={phone} onChangeText={setPhone} />
                  <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handleSendOtp} disabled={loading} style={{ marginTop: 20 }}>
                    <Animated.View style={[styles.primaryBtn, buttonAnimatedStyle]}>
                      {loading ? (
                        <ActivityIndicator color="#111" />
                      ) : (
                        <Text style={styles.primaryText}>Send OTP</Text>
                      )}
                    </Animated.View>
                  </Pressable>
                </Animated.View>
              )}

              {authStep === 'otp' && (
                <Animated.View entering={FadeInDown.duration(400).delay(200)}>
                  <View style={styles.whatsappMessageContainer}>
                    <Ionicons name="logo-whatsapp" size={24} color="#25D366" style={styles.whatsappIcon} />
                    <View style={styles.whatsappTextContainer}>
                      <Text style={styles.whatsappText}>
                        OTP sent to <Text style={styles.whatsappHighlight}>WhatsApp</Text> this number
                      </Text>
                      <Text style={styles.whatsappPhone}>+91 {phone}</Text>
                    </View>
                  </View>
                  <OtpInput value={otp} onChangeText={setOtp} length={6} />

                  {/* Terms & Conditions Row (UI Only) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8, paddingHorizontal: 4 }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (!termsViewed) {
                          setShowTermsModal(true);
                        } else {
                          setTermsAccepted(!termsAccepted);
                        }
                      }}
                      style={{ marginRight: 8, padding: 4 }}
                    >
                      <Ionicons
                        name={termsAccepted ? "checkbox" : "square-outline"}
                        size={24}
                        color={termsAccepted ? COLORS.saffron : "#888"}
                      />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 13, color: "#111", flex: 1 }}>
                      I agree to the{" "}
                      <Text
                        style={{ color: COLORS.saffron, fontWeight: "700" }}
                        onPress={() => setShowTermsModal(true)}
                      >
                        Terms & Conditions
                      </Text>
                      {" "}and{" "}
                      <Text
                        style={{ color: COLORS.saffron, fontWeight: "700" }}
                        onPress={() => setShowPrivacyModal(true)}
                      >
                        Privacy Policy
                      </Text>
                    </Text>
                  </View>

                  <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handleVerifyOtp} disabled={loading} style={{ marginTop: 12 }}>
                    <Animated.View style={[styles.primaryBtn, buttonAnimatedStyle, otp.length < 4 && { opacity: 0.5 }]}>
                      {loading ? (
                        <ActivityIndicator color="#111" />
                      ) : (
                        <Text style={styles.primaryText}>Verify OTP</Text>
                      )}
                    </Animated.View>
                  </Pressable>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 20 }}>
                    <TouchableOpacity onPress={() => {
                      if (resendTimer === 0) handleSendOtp();
                    }} disabled={resendTimer > 0}>
                      <Text style={[styles.linkText, resendTimer > 0 && { color: '#999' }]}>
                        {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => {
                      setAuthStep('phone');
                      setOtp('');
                    }}>
                      <Text style={styles.linkText}>Change Mobile Number</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}


            </View>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* DROPDOWN MODAL */}
      <Modal visible={showServiceDropdown} transparent animationType="fade" statusBarTranslucent={true} onRequestClose={() => setShowServiceDropdown(false)}>
        <Pressable style={dropdownStyles.overlay} onPress={() => setShowServiceDropdown(false)}>
          <Pressable style={dropdownStyles.container} onPress={(e) => e.stopPropagation()}>
            <View style={dropdownStyles.header}>
              <Text style={dropdownStyles.title}>Choose Service for 40% OFF 🎉</Text>
              <TouchableOpacity onPress={() => setShowServiceDropdown(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {eligibleServices.map((svc) => {
                const isSelected = selectedService?.id === svc.id;
                return (
                  <TouchableOpacity
                    key={svc.id}
                    style={[dropdownStyles.item, isSelected && { backgroundColor: COLORS.saffron + "20" }]}
                    onPress={() => { setSelectedService(svc); setShowServiceDropdown(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[dropdownStyles.itemTitle, isSelected && { fontWeight: "800", color: "#000" }]}>{svc.title}</Text>
                      {svc.service_type && <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{svc.service_type}</Text>}
                    </View>
                    <View style={dropdownStyles.badge}>
                      <Text style={{ color: COLORS.saffron, fontWeight: "800", fontSize: 12 }}>40% OFF</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* PRIVACY POLICY MODAL */}
      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setTermsViewed(true);
          setTermsAccepted(true);
          setShowTermsModal(false);
        }}
      />
      <PrivacyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onAccept={() => {
          setShowPrivacyModal(false);
        }}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  termTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginTop: 16,
    marginBottom: 4,
  },
  termText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: "5%",
    paddingTop: 30,
    paddingBottom: 40
  },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mobileCharacterContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -45, // Deeper overlap to place character behind card
    marginTop: 10,
    zIndex: 1,
  },
  desktopCharacterContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  mobileCharacterImage: {
    width: 180, // Scaled down
    height: 160,
  },
  desktopCharacterImage: {
    width: "100%",
    height: 500,
    maxWidth: 450,
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24, // reduced corners slightly
    padding: 20, // reduced internal padding
    paddingTop: 24, // Card top spacing
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    zIndex: 2,
  },
  desktopFormContainer: {
    flex: 1,
    maxWidth: 500,
    marginVertical: 40,
  },
  header: {
    marginBottom: 20,
    alignItems: "center", // Center horizontally
  },
  logo: {
    width: 130, // Smaller branding
    height: 38,
    marginBottom: 16, // Spacing between logo and heading
  },
  subtitle: {
    color: "#111", // Black/dark text
    fontSize: 16,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-rounded' : 'Arial Rounded MT Bold',
    fontWeight: Platform.OS === 'android' ? 'normal' : '700',
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  form: {
    gap: 12, // reduced gaps
  },
  animatedInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#F0F0F0", // subtle grey
    backgroundColor: "#FFFFFF",
    borderRadius: 14, // slightly rounder
    paddingVertical: 12, // shorter height
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    color: "#111",
    fontWeight: "500",
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.saffron,
    marginBottom: 8,
    marginLeft: 4,
  },
  expiredOfferContainer: {
    padding: 12,
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#F0F0F0"
  },
  expiredOfferText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "600",
  },
  whatsappMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  whatsappIcon: {
    marginRight: 12,
  },
  whatsappTextContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  whatsappText: {
    fontFamily: Platform.OS === 'android' ? 'sans-serif-rounded' : 'Arial Rounded MT Bold',
    color: '#333',
    fontSize: 14,
  },
  whatsappHighlight: {
    color: '#25D366',
    fontWeight: '700',
  },
  whatsappPhone: {
    fontFamily: Platform.OS === 'android' ? 'sans-serif-rounded' : 'Arial Rounded MT Bold',
    color: '#111',
    fontSize: 15,
    fontWeight: Platform.OS === 'android' ? 'normal' : '800',
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: COLORS.saffron,
    height: 52, // Shorter height
    borderRadius: 14, // match input border radius
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: COLORS.saffron,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, // subtle shadow
    shadowRadius: 8,
    elevation: 4,
  },
  primaryText: {
    color: "#111",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  forgotPasswordText: {
    color: "#111",
    fontWeight: "700",
    fontSize: 13,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#F0F0F0"
  },
  dividerText: {
    marginHorizontal: 12,
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
  },
  googleBtn: {
    height: 52, // Shorter height
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  googleIcon: {
    width: 22,
    height: 22
  },
  googleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111"
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },
  linkText: {
    fontWeight: "800",
    color: COLORS.saffron,
    fontSize: 14,
  },
  policyContainer: {
    paddingHorizontal: 6,
    marginTop: -2,
    marginBottom: 4,
    gap: 6,
    backgroundColor: "#F9F9F9",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EAEAEA",
  },
  policyHeader: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
    color: "#333",
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  policyText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

const dropdownStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 30,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.saffron + "20",
  },
});

