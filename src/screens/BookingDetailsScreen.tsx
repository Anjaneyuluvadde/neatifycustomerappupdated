import { RouteProp, useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../context/LanguageContext";
import { useNotification } from "../hooks/useNotification";
import { supabase } from "../lib/supabase";
import { invokeFunction } from "../lib/backendClient";
import { RootStackParamList } from "../navigation/AppNavigator";

type Props = {
  route: RouteProp<RootStackParamList, "BookingDetails">;
};

import ReviewModal from "../components/ReviewModal";
import AnimatedGradientBorder from "../components/AnimatedGradientBorder";
import { useTheme } from "../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";

export default function BookingDetailsScreen({ route }: Props) {
  const { booking: initialBooking } = route.params;
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const { showAlert, showToast } = useNotification();
  const [booking, setBooking] = useState(initialBooking);
  const normalizedWorkStatus = String(booking?.work_status || "").trim().toUpperCase();
  const [isEligibleToCancel, setIsEligibleToCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellationDetails, setCancellationDetails] = useState<{
    fee: number;
    refund_amount: number;
    is_free: boolean;
    hours_until_service: number;
    total_amount?: number;
  } | null>(null);
  const [fetchingFees, setFetchingFees] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const bottomNavPadding = useBottomNavPadding();

  // Review State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [review, setReview] = useState<{ rating: number; comment: string } | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Fetch fresh booking data on mount
  useEffect(() => {
    if (!initialBooking?.id) return;
    const fetchLatest = async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", initialBooking.id)
        .maybeSingle();
      if (data && !error) {
        setBooking(data as typeof initialBooking);
      }
    };
    fetchLatest();
  }, [initialBooking?.id]);

  // 🟢 Service Checklist Feature
  const [checklist, setChecklist] = useState<Record<number, boolean>>({});
  const [submittingChecklist, setSubmittingChecklist] = useState(false);
  const [isChecklistSubmitted, setIsChecklistSubmitted] = useState(false);

  const services = React.useMemo(() => {
    if (!booking.services) return [];
    if (typeof booking.services === 'string') {
      try {
        return JSON.parse(booking.services);
      } catch {
        return [];
      }
    }
    return Array.isArray(booking.services) ? booking.services : [];
  }, [booking.services]);

  const checklistItems = React.useMemo(() => {
    const serviceName = (services[0]?.title || services[0]?.service_name || "").toLowerCase();
    
    if (serviceName.includes("bathroom")) {
      return [
        "Customer & property details verified",
        "Floor, tiles, toilet, wash basin & fixtures cleaned",
        "Mirrors & glass surfaces wiped",
        "Exhaust fan & switchboards cleaned",
        "Cobwebs removed",
        "Final inspection completed & customer satisfied"
      ];
    } else if (serviceName.includes("kitchen")) {
      return [
        "Customer & property details verified",
        "Countertop, hob, sink, cabinets & floor completed",
        "Chimney exterior wiped",
        "Appliances exterior wiped",
        "Exhaust fan & switchboards cleaned",
        "Final inspection completed & customer satisfied"
      ];
    } else if (serviceName.includes("sofa")) {
      return [
        "Customer & property details verified",
        "Dry vacuuming of sofa completed",
        "Shampooing and wet vacuuming completed",
        "Cushions properly cleaned",
        "Stains spot-treated",
        "Final inspection completed & customer satisfied"
      ];
    } else if (serviceName.includes("window") || serviceName.includes("door")) {
      return [
        "Customer & property details verified",
        "Window panes & glass cleaned",
        "Tracks & channels vacuumed/wiped",
        "Mosquito nets brushed",
        "Doors & frames wiped",
        "Final inspection completed & customer satisfied"
      ];
    } else if (serviceName.includes("balcony")) {
      return [
        "Customer & property details verified",
        "Balcony floor scrubbed & washed",
        "Railings wiped & cleaned",
        "Cobwebs removed",
        "Final inspection completed & customer satisfied"
      ];
    } else if (serviceName.includes("express")) {
      return [
        "Customer & property details verified",
        "Dry dusting of all rooms completed",
        "Floors swept and mopped",
        "Basic tidying up of living spaces",
        "Final inspection completed & customer satisfied"
      ];
    }
    
    return [
      "Customer & property details verified",
      "Required areas/access confirmed",
      "Service scope & requirements confirmed",
      "Cleaning materials & equipment available",
      "All selected service areas cleaned",
      "Floors, surfaces & fixtures properly cleaned",
      "Kitchen, bathrooms & applicable areas completed",
      "Windows/glass & included tasks completed",
      "No visible dirt or waste left behind",
      "Final inspection completed & customer satisfied"
    ];
  }, [services]);

  useEffect(() => {
    if (!booking.id) return;
    const loadChecklist = async () => {
      try {
        const stored = await AsyncStorage.getItem(`booking_checklist_${booking.id}`);
        if (stored) {
          setChecklist(JSON.parse(stored));
        }
        const submitted = await AsyncStorage.getItem(`booking_checklist_submitted_${booking.id}`);
        if (submitted === 'true') {
          setIsChecklistSubmitted(true);
        }
      } catch (e) {
        console.warn("Failed to load checklist", e);
      }
    };
    loadChecklist();
  }, [booking.id]);

  const toggleChecklistItem = async (index: number) => {
    try {
      const updated = { ...checklist, [index]: !checklist[index] };
      setChecklist(updated);
      await AsyncStorage.setItem(`booking_checklist_${booking.id}`, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save checklist", e);
    }
  };

  const handleCustomerSubmit = async () => {
    try {
      const bookingId = booking?.id;
      const tasks = checklistItems.map((title, index) => ({
        title,
        isCompleted: !!checklist[index],
      }));

      // 1. Check if bookingId is missing
      if (!bookingId) {
        Alert.alert("Error", "Booking ID is missing!");
        return;
      }

      setSubmittingChecklist(true);

      const payload = tasks.map((task, index) => ({
        booking_id: bookingId,
        task_index: index,
        task_title: task.title,
        customer_completed: task.isCompleted,
      }));

      // 2. Upsert checklist to Supabase
      const { data, error } = await supabase.from('booking_checklists').upsert(payload, {
        onConflict: 'booking_id,task_index'
      });

      // 3. Handle response
      if (error) {
        console.log("Error details:", error.message);
        Alert.alert("Error", "Failed to save: " + error.message);
      } else {
        setIsChecklistSubmitted(true);
        AsyncStorage.setItem(`booking_checklist_submitted_${bookingId}`, 'true');
        Alert.alert("Success", "Checklist submitted successfully!");
      }
    } catch (err: any) {
      console.log("Submit checklist error:", err);
      Alert.alert("Error", "Something went wrong while submitting the checklist!");
    } finally {
      setSubmittingChecklist(false);
    }
  };

  const checklistProgress = Object.values(checklist).filter(Boolean).length;


  // Real-time subscription for booking updates (OTPs, staff assignment, etc.)
  useEffect(() => {
    if (!booking.id) return;

    const subscription = supabase
      .channel(`booking:${booking.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${booking.id}`,
        },
        (payload) => {
          console.log('Booking updated:', payload.new);
          setBooking(payload.new as typeof booking);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [booking.id]);

  // 🟢 NEW POLICY: Calculate time difference and deep cleaning status
  const { diffHours, isDeepCleaning } = React.useMemo(() => {
    if (!booking.booking_date || !booking.booking_time) return { diffHours: 999, isDeepCleaning: false };
    try {
      const scheduledStr = `${booking.booking_date} ${booking.booking_time}`;
      const scheduledDate = new Date(scheduledStr);
      const now = new Date();
      const diff = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      const deep = services.some((s: any) => 
        s.title.toLowerCase().includes("deep cleaning")
      );
      
      return { diffHours: diff, isDeepCleaning: deep };
    } catch (e) {
      return { diffHours: 999, isDeepCleaning: false };
    }
  }, [booking.booking_date, booking.booking_time, services]);

  // 🟢 Fetch dynamic cancellation_fee column from services table
  const [serviceCancellationFee, setServiceCancellationFee] = useState<number | null>(null);

  useEffect(() => {
    const fetchCancellationFee = async () => {
      if (!services || services.length === 0) return;

      const embeddedFee = services.find((s: any) => s.cancellation_fee !== undefined && s.cancellation_fee !== null);
      if (embeddedFee) {
        setServiceCancellationFee(Number(embeddedFee.cancellation_fee));
        return;
      }

      const ids = services.map((s: any) => s.id).filter(Boolean);
      const titles = services.map((s: any) => s.title || s.service_name).filter(Boolean);

      let query = supabase.from("services").select("cancellation_fee, id, title");
      if (ids.length > 0) {
        query = query.in("id", ids);
      } else if (titles.length > 0) {
        query = query.in("title", titles);
      } else {
        return;
      }

      const { data } = await query;
      if (data && data.length > 0) {
        const fees = data
          .map((item: any) => item.cancellation_fee)
          .filter((f: any) => f !== null && f !== undefined)
          .map(Number);
        if (fees.length > 0) {
          setServiceCancellationFee(Math.max(...fees));
        }
      }
    };

    fetchCancellationFee();
  }, [services]);

  // Check Cancellation Eligibility
  useEffect(() => {
    const checkEligibility = () => {
      let clientEligible = true;
      if (['COMPLETED', 'CANCELLED'].includes(normalizedWorkStatus)) {
        clientEligible = false;
      }
      setIsEligibleToCancel(clientEligible);
    };
    checkEligibility();
  }, [booking.work_status]);

  const handleCancelBooking = async () => {
    if (!isEligibleToCancel) {
      showAlert({
        type: "info",
        title: t("notifications.cancellationClosed"),
        message: "Cancellation is no longer available for this booking status."
      });
      return;
    }

    setFetchingFees(true);
    try {
      let { data, error } = await supabase.rpc('calculate_cancellation_details', {
        booking_uuid: booking.id
      });

      if (error) throw error;

      // 🟢 Enforce 6-hour policy override in frontend if RPC returns 0
      // Explicitly check for the 6-hour boundary (<= 6 hours)
      if (diffHours <= 6 && (!data || data.fee === 0)) {
        const fee = serviceCancellationFee !== null ? serviceCancellationFee : (isDeepCleaning ? 299 : 99);
        data = {
          ...data,
          fee: fee,
          is_free: false,
          total_amount: data?.total_amount || booking.total_amount,
          refund_amount: Math.max(0, (data?.total_amount || booking.total_amount || 0) - fee),
          hours_until_service: diffHours
        };
      }

      setCancellationDetails(data);
      setShowCancelModal(true);
    } catch (err) {
      console.error("Error fetching cancellation details:", err);
      setShowCancelModal(true);
    } finally {
      setFetchingFees(false);
    }
  };

  const confirmCancellation = async () => {
    if (!cancelReason.trim()) {
      showAlert({
        type: "warning",
        title: t("notifications.reasonRequired"),
        message: t("notifications.reasonMessage")
      });
      return;
    }

    setCancelling(true);

    try {
      // Update booking with cancellation + refund tracking + calculated fees
      const { error } = await supabase
        .from('bookings')
        .update({
          work_status: 'CANCELLED',
          cancel_requested: true,
          cancel_reason: cancelReason,
          cancel_time: new Date().toISOString(),
          refund_status: 'PENDING',
          cancellation_fee: cancellationDetails?.fee || 0,
          refund_amount: cancellationDetails?.refund_amount || booking.total_amount,
        })
        .eq('id', booking.id);

      if (error) throw error;

      // ✅ Send WhatsApp Cancellation Notification
      try {
        await invokeFunction("booking-cancelled-whatsapp", {
          body: {
            customer_phone: booking.customer_phone,
            customer_name: booking.customer_name,
            service_title: services[0]?.title || 'Service',
            booking_id: booking.id,
            reason: cancelReason || "Cancelled by Customer"
          },
        });
        console.log("✅ WhatsApp cancellation sent");
      } catch (waError) {
        console.error("WhatsApp sending failed (non-critical):", waError);
      }

      setShowCancelModal(false);
      showToast(t("notifications.bookingCancelled"), "success");
    } catch (err) {
      showAlert({
        type: "error",
        title: t("common.error"),
        message: t("notifications.cancellationFailed")
      });
      console.error(err);
    } finally {
      setCancelling(false);
    }
  };

  /* ================= REVIEW SYSTEM ================= */

  // Fetch existing review
  useEffect(() => {
    if (normalizedWorkStatus === "COMPLETED") {
      fetchReview();
    }
  }, [booking.id, booking.work_status]);

  const fetchReview = async () => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("rating, comment")
        .eq("booking_id", booking.id)
        .single(); // Assuming one review per booking

      if (data) {
        setReview(data);
      }
    } catch (err) {
      console.log("No review found or error fetching:", err);
    }
  };

  const handleRateService = () => {
    setShowReviewModal(true);
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    setSubmittingReview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Check if review exists to update or insert
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", booking.id)
        .single();

      let error;
      if (existingReview) {
        // Update
        const { error: updateError } = await supabase
          .from("reviews")
          .update({ rating, comment })
          .eq("id", existingReview.id);
        error = updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from("reviews")
          .insert({
            booking_id: booking.id,
            user_id: user.id,
            rating,
            comment,
          });
        error = insertError;
      }

      if (error) throw error;

      setReview({ rating, comment });
      setShowReviewModal(false);
      showToast(t("review.submitSuccess"), "success");

    } catch (err) {
      console.error(err);
      showAlert({
        type: "error",
        title: t("common.error"),
        message: t("review.submitError"),
      });
    } finally {
      setSubmittingReview(false);
    }
  };


  /* ================= STAFF DETAILS ================= */

  const [staffName, setStaffName] = useState<string | null>(null);
  const [staffPhone, setStaffPhone] = useState<string | null>(null);

  useEffect(() => {
    const fetchStaffDetails = async () => {
      if (!booking.assigned_staff_email) return;

      const { data, error } = await supabase
        .from("staff_profile")
        .select("name, phone")
        .eq("email", booking.assigned_staff_email)
        .single();

      if (data) {
        if (data.name) setStaffName(data.name);
        if (data.phone) setStaffPhone(data.phone);
      }
    };

    fetchStaffDetails();
  }, [booking.assigned_staff_email]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Fetch fresh booking data
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', booking.id)
        .single();

      if (data && !error) {
        setBooking(data);

        // Re-check cancellation eligibility
        const { data: eligible } = await supabase.rpc(
          'check_cancellation_eligibility',
          { booking_uuid: booking.id }
        );
        if (eligible !== null) {
          setIsEligibleToCancel(eligible);
        }
      }
    } catch (err) {
      console.error('Error refreshing booking:', err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
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
        {/* HEADER */}
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.title, { color: theme.text }]}>{t("bookingDetails.title")}</Text>
            <TouchableOpacity
              onPress={() => {
                const phoneNumber = "tel:7617618567";
                Linking.canOpenURL(phoneNumber).then(supported => {
                  if (supported) Linking.openURL(phoneNumber);
                });
              }}
              style={[styles.helpBtn, { borderColor: theme.border }]}
            >
              <Ionicons name="help-circle-outline" size={20} color={theme.primary} />
              <Text style={[styles.helpText, { color: theme.primary }]}>Help</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CANCELLATION WARNING BANNER */}
        {diffHours <= 6 && diffHours > 0 && !['CANCELLED', 'COMPLETED'].includes(normalizedWorkStatus) && (
          <View style={styles.warningBanner}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.warningText}>
              Cancellation within 6 hours of service incurs a fee of ₹{serviceCancellationFee !== null ? serviceCancellationFee : (isDeepCleaning ? '299' : '99')}.
            </Text>
          </View>
        )}

        <Text style={[styles.section, { color: theme.textLight }]}>{t("bookingDetails.customerDetails")}</Text>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={[styles.bold, { color: theme.text }]}>{booking.customer_name || 'N/A'}</Text>
          <Text style={{ color: theme.text }}>{booking.email || 'N/A'}</Text>
          <Text style={{ color: theme.text }}>{booking.phone_number || 'N/A'}</Text>
        </View>

        <Text style={[styles.section, { color: theme.textLight }]}>{t("bookingDetails.serviceAddress")}</Text>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={{ color: theme.text }}>{booking.full_address || 'No address provided'}</Text>
        </View>

        {/* SERVICES */}
        <Text style={[styles.section, { color: theme.textLight }]}>{t("bookingDetails.services")}</Text>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {services.length > 0 ? (
            services.map((s: any, index: number) => (
              <View key={s.id || index} style={[styles.serviceRow, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.bold, { color: theme.text }]}>{s.title || s.service_name || 'Service'}</Text>
                  <Text style={{ color: theme.textLight, marginTop: 2 }}>{s.duration || 'N/A'}</Text>
                </View>
                <Text style={{ fontWeight: "700", flexShrink: 0, color: theme.text }}>
                  {String(s.price || '0').startsWith('₹') ? s.price : `₹${s.price || 0}`}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.text }}>{t("bookingDetails.noServices")}</Text>
          )}
        </View>

        <Text style={[styles.section, { color: theme.textLight }]}>{t("bookingDetails.schedule")}</Text>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={{ color: theme.text }}>
            {booking.booking_date || 'N/A'} at {booking.booking_time || 'N/A'}
          </Text>
        </View>

        {/* PAYMENT */}
        <Text style={[styles.section, { color: theme.textLight }]}>{t("bookingDetails.payment")}</Text>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.row}>
            <Text style={[styles.bold, { color: theme.text }]}>{t("bookingDetails.total")}</Text>
            <Text style={[styles.bold, { color: theme.text }]}>₹{booking.total_amount}</Text>
          </View>
          <Text style={{ color: theme.text }}>{t("bookingDetails.status")}: {booking.payment_status}</Text>
        </View>

        {/* STAFF ASSIGNMENT - Only show for non-completed bookings */}
        {normalizedWorkStatus !== "COMPLETED" && normalizedWorkStatus !== "CANCELLED" && booking.payment_status !== "failed" && (
          <>
            <Text style={[styles.section, { color: theme.textLight }]}>{t("bookingDetails.staffAssignment")}</Text>
            <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {!booking.assigned_staff_email ? (
                <View style={[styles.pendingContainer, { backgroundColor: theme.surfaceVariant }]}>
                  <Text style={[styles.pendingText, { color: theme.text }]}>
                    {t("bookingDetails.staffPending")}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={[styles.assignedHeader, { backgroundColor: isDark ? "rgba(34, 197, 94, 0.2)" : "#dcfce7" }]}>
                    <Text style={[styles.assignedLabel, { color: isDark ? "#4ade80" : "#166534" }]}>{t("bookingDetails.staffAssigned")}</Text>
                  </View>

                  {/* Staff Name & Phone */}
                  {staffName ? (
                    <Text style={[styles.staffNameText, { color: theme.text }]}>
                      {staffName}
                    </Text>
                  ) : null}

                  {staffPhone ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        const url = `tel:${staffPhone}`;
                        Linking.canOpenURL(url).then((supported) => {
                          if (supported) {
                            Linking.openURL(url);
                          }
                        });
                      }}
                      style={[styles.staffPhoneCard, { backgroundColor: theme.background, borderColor: theme.border }]}
                    >
                      <View style={[styles.staffPhoneIcon, { backgroundColor: theme.surfaceVariant }]}>
                        <Text style={{ fontSize: 18 }}>📞</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.staffPhoneLabel, { color: theme.textLight }]}>Call Staff</Text>
                        <Text style={[styles.staffPhoneNumber, { color: theme.text }]}>
                          {staffPhone.replace(/^\+?91/, '')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}

                  {/* STAFF ASSIGNMENT - Only show for non-completed bookings */}
                  <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border, marginBottom: 16, marginTop: 4 }} />

                  <View style={styles.otpContainer}>
                    <View style={[styles.otpBox, { backgroundColor: theme.surfaceVariant }]}>
                      <Text style={[styles.otpLabel, { color: theme.textLight }]}>{t("bookingDetails.startOtp")}</Text>
                      <Text style={[styles.otpCode, { color: theme.text }]}>{booking.startotp || "N/A"}</Text>
                      <Text style={[styles.otpSubtext, { color: theme.textLight }]}>{t("bookingDetails.startOtpHelp")}</Text>
                    </View>
                    <View style={[styles.otpBox, { backgroundColor: theme.surfaceVariant }]}>
                      <Text style={[styles.otpLabel, { color: theme.textLight }]}>{t("bookingDetails.endOtp")}</Text>
                      <Text style={[styles.otpCode, { color: theme.text }]}>{booking.endotp || "N/A"}</Text>
                      <Text style={[styles.otpSubtext, { color: theme.textLight }]}>{t("bookingDetails.endOtpHelp")}</Text>
                    </View>
                  </View>

                  <Text style={styles.otpHint}>
                    {t("bookingDetails.otpInstruction")}
                  </Text>
                </>
              )}
            </View>
          </>
        )}

        {/* CANCEL BUTTON */}
        {normalizedWorkStatus !== 'CANCELLED' && normalizedWorkStatus !== 'COMPLETED' && booking.payment_status !== 'failed' && normalizedWorkStatus !== 'PAYMENT FAILED' ? (
          <View>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                !isEligibleToCancel ? styles.disabledCancelButton : null
              ]}
              onPress={handleCancelBooking}
              disabled={cancelling || fetchingFees}
            >
              {cancelling || fetchingFees ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.cancelButtonText}>{t("bookingDetails.cancelBooking")}</Text>
              )}
            </TouchableOpacity>
            {!isEligibleToCancel && (
              <Text style={[styles.expiryNote, { color: theme.error || '#ef4444' }]}>
                {t("bookingDetails.cancellationExpired")}
              </Text>
            )}
          </View>
        ) : null}

        {/* CANCELLED STATUS */}
        {booking.work_status === 'CANCELLED' && (
          <View style={[
            styles.cancelButton,
            styles.disabledButton,
            booking.refund_status === 'REFUNDED' ? styles.refundCompletedButton : null,
            (booking.refund_status && booking.refund_status !== 'REFUNDED') ? styles.refundPendingButton : null
          ]}>
            <Text style={styles.cancelButtonText}>
              {booking.refund_status === 'REFUNDED' ? t("bookingDetails.refundCompleted") :
                booking.refund_status === 'PENDING' ? t("bookingDetails.refundPending") :
                (booking.refund_status && booking.refund_status !== 'REFUNDED') ? t("bookingDetails.refundInitiated") :
                  t("bookingDetails.bookingCancelled")}
            </Text>
            {booking.refund_status && booking.refund_status !== 'REFUNDED' && (
              <Text style={{ color: '#f1f5f9', fontSize: 13, marginTop: 6, fontWeight: '500' }}>
                {t("bookingDetails.refundNote")}
              </Text>
            )}
          </View>
        )}

        {/* REVIEW SECTION (Only if Completed) */}
        {normalizedWorkStatus === "COMPLETED" && (
          <View style={[styles.reviewContainer, { backgroundColor: theme.background }]}>
            <Text style={[styles.section, { color: theme.textLight }]}>{t("serviceDetail.reviews")}</Text>
            <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {review ? (
                <View>
                  <Text style={[styles.reviewLabel, { color: theme.textLight }]}>{t("review.yourRating")}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontSize: 24, fontWeight: "bold", color: "#F4C430", marginRight: 8 }}>
                      {review.rating} ★
                    </Text>
                    <Text style={{ color: theme.textLight }}>
                      {review.rating >= 4 ? "Extremely Good! 🤩" : review.rating >= 3 ? "Good 🙂" : "Could be better 😐"}
                    </Text>
                  </View>
                  {review.comment ? (
                    <Text style={{ fontStyle: "italic", color: theme.text, marginBottom: 12 }}>
                      "{review.comment}"
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={styles.editReviewBtn}
                    onPress={handleRateService}
                  >
                    <Text style={styles.editReviewText}>{t("review.editReview")}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ alignItems: "center", padding: 10 }}>
                  <Text style={{ color: "#64748b", marginBottom: 12 }}>
                    Rate your experience with us!
                  </Text>
                  <TouchableOpacity
                    style={styles.rateButton}
                    onPress={handleRateService}
                  >
                    <Text style={styles.rateButtonText}>{t("review.rateService")}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* SERVICE CHECKLIST */}
        {normalizedWorkStatus !== "CANCELLED" && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.section, { color: theme.text, marginBottom: 0, marginTop: 0 }]}>Service Checklist</Text>
              {normalizedWorkStatus === "COMPLETED" && (
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? "#4ade80" : "#16a34a" }}>
                  {checklistProgress} / {checklistItems.length} completed
                </Text>
              )}
            </View>

            {normalizedWorkStatus !== "COMPLETED" ? (
              <View style={{
                backgroundColor: theme.surfaceVariant,
                padding: 24,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: theme.border,
                borderStyle: "dashed"
              }}>
                <Ionicons name="lock-closed" size={32} color={theme.textLight} style={{ marginBottom: 12 }} />
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700", textAlign: "center", marginBottom: 6 }}>
                  Checklist Locked
                </Text>
                <Text style={{ color: theme.textLight, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
                  Service must be completed (Start and End OTPs verified) to unlock this checklist.
                </Text>
              </View>
            ) : (
              <>
                {checklistItems.map((item, index) => {
                  const isChecked = !!checklist[index];
                  return (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.7}
                      onPress={() => toggleChecklistItem(index)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 8,
                        backgroundColor: theme.surfaceVariant,
                        padding: 12,
                        borderRadius: 8
                      }}
                    >
                      <Ionicons
                        name={isChecked ? "checkbox" : "square-outline"}
                        size={22}
                        color={isChecked ? (isDark ? "#4ade80" : "#16a34a") : theme.textLight}
                        style={{ marginRight: 12 }}
                      />
                      <Text style={{
                        flex: 1,
                        fontSize: 14,
                        color: isChecked ? theme.textLight : theme.text,
                        textDecorationLine: isChecked ? 'line-through' : 'none',
                        opacity: isChecked ? 0.6 : 1
                      }}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                
                <TouchableOpacity 
                  style={{
                    backgroundColor: isChecklistSubmitted ? "#10B981" : "#F4C430",
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                    marginTop: 12,
                    opacity: (submittingChecklist || isChecklistSubmitted) ? 0.7 : 1
                  }} 
                  onPress={handleCustomerSubmit}
                  disabled={submittingChecklist || isChecklistSubmitted}
                >
                  {submittingChecklist ? (
                    <ActivityIndicator color="#111" />
                  ) : (
                    <Text style={{ color: isChecklistSubmitted ? "#fff" : "#111", fontWeight: "700", fontSize: 16 }}>
                      {isChecklistSubmitted ? "Submitted" : "Submit Checklist"}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* CANCEL REASON MODAL */}
        <Modal
          visible={showCancelModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCancelModal(false)}
          statusBarTranslucent={true}
        >
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.modalOverlay}
          >
            <AnimatedGradientBorder
              borderRadius={20}
              borderWidth={2}
              animationSpeed={3}
              style={{ width: "100%", maxWidth: 360 }}
            >
              <View style={[styles.modalContent, { width: "100%", borderRadius: 20, margin: 0, backgroundColor: theme.background }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{t("bookingDetails.cancelModalTitle")}</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textLight }]}>
                  {t("bookingDetails.cancelModalSubtitle")}
                </Text>

                {/* CANCELLATION SUMMARY */}
                {cancellationDetails && (
                  <View style={[styles.feeContainer, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                    <View style={styles.feeRow}>
                      <Text style={[styles.feeLabel, { color: theme.text }]}>Total Amount</Text>
                      <Text style={[styles.feeValue, { color: theme.text }]}>₹{cancellationDetails.total_amount}</Text>
                    </View>
                    <View style={styles.feeRow}>
                      <Text style={[styles.feeLabel, { color: theme.text }]}>Cancellation Charge</Text>
                      <Text style={[styles.feeValue, { color: cancellationDetails.fee > 0 ? '#ef4444' : '#22c55e' }]}>
                        {cancellationDetails.fee > 0 ? `- ₹${cancellationDetails.fee}` : 'Free'}
                      </Text>
                    </View>
                    <View style={[styles.feeRow, styles.feeTotalRow, { borderTopColor: theme.border }]}>
                      <Text style={[styles.feeLabelTotal, { color: theme.text }]}>Final Refund</Text>
                      <Text style={[styles.feeValueTotal, { color: theme.primary }]}>₹{cancellationDetails.refund_amount}</Text>
                    </View>
                    {cancellationDetails.fee > 0 && (
                      <Text style={styles.feeNote}>
                        * Fee applied as cancellation is within 6 hours of service.
                      </Text>
                    )}
                  </View>
                )}

                <TextInput
                  style={[styles.reasonInput, { backgroundColor: theme.surfaceVariant, color: theme.text, borderColor: theme.border }]}
                  placeholderTextColor={theme.textLight}
                  placeholder={t("bookingDetails.cancelReasonPlaceholder")}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  multiline
                  textAlignVertical="top"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalCancelBtn]}
                    onPress={() => setShowCancelModal(false)}
                    disabled={cancelling}
                  >
                    <Text style={styles.modalCancelText}>{t("bookingDetails.dontCancel")}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalConfirmBtn]}
                    onPress={confirmCancellation}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalConfirmText}>{t("bookingDetails.confirmCancel")}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </AnimatedGradientBorder>
          </KeyboardAvoidingView>
        </Modal>

        {/* REVIEW MODAL */}
        <ReviewModal
          visible={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSubmit={handleSubmitReview}
          initialRating={review?.rating}
          initialComment={review?.comment}
          isSubmitting={submittingReview}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: "800" },

  section: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
  },

  warningBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  warningText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
  },

  serviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  bold: { fontWeight: "700" },

  // Staff Assignment Styles
  pendingContainer: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  pendingText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },
  assignedHeader: {
    marginBottom: 12,
  },
  assignedLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16a34a",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  otpBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
    marginBottom: 6,
  },
  otpCode: {
    fontSize: 24,
    fontWeight: "800",
    color: "#78350f",
    letterSpacing: 2,
  },
  otpSubtext: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e",
    marginTop: 6,
    textAlign: "center",
  },
  otpHint: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
    marginTop: 8,
  },
  cancelButton: {
    marginTop: 30,
    backgroundColor: "#EF4444",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#EF4444",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  disabledCancelButton: {
    backgroundColor: "#94a3b8",
    shadowColor: "transparent",
    elevation: 0,
  },
  expiryNote: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -10,
    marginBottom: 20,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  helpText: {
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: "#94a3b8", // Gray for cancelled
    shadowColor: "#94a3b8",
    elevation: 0,
  },
  refundPendingButton: {
    backgroundColor: "#F4C430", // Orange for pending refund
    shadowColor: "#F4C430",
    elevation: 4,
  },
  refundCompletedButton: {
    backgroundColor: "#10B981", // Green for refund completed
    shadowColor: "#10B981",
    elevation: 4,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    height: 100,
    fontSize: 15,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtn: {
    borderWidth: 1,
  },
  modalConfirmBtn: {
    backgroundColor: "#EF4444",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748b",
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  reviewContainer: {
    marginBottom: 20,
  },
  reviewLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  rateButton: {
    backgroundColor: "#F4C430",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  rateButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  editReviewBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#F4C430",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  editReviewText: {
    color: "#F4C430",
    fontWeight: "600",
    fontSize: 14,
  },
  staffNameText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  staffPhoneCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  staffPhoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  staffPhoneLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16a34a",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  staffPhoneNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  feeContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  feeTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  feeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  feeLabelTotal: {
    fontSize: 16,
    fontWeight: '700',
  },
  feeValueTotal: {
    fontSize: 16,
    fontWeight: '800',
  },
  feeNote: {
    fontSize: 11,
    color: '#ef4444',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});
