import React, { useEffect, useState } from "react";
import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { COLORS } from "../theme/colors";

interface PrivacyModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  // If provided, use this instead of fetching again (optimizes CheckoutScreen which already fetches)
  prefetchedPrivacy?: string;
}

export default function PrivacyModal({ visible, onClose, onAccept, prefetchedPrivacy }: PrivacyModalProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [privacy, setPrivacy] = useState<string | null>(null);

  useEffect(() => {
    // If the parent already fetched the privacy, don't fetch again
    if (prefetchedPrivacy) return;
    
    // Otherwise, fetch when the modal becomes visible
    const fetchPrivacy = async () => {
      const { data, error } = await supabase
        .from("app_policies")
        .select("user_policies")
        .limit(1)
        .maybeSingle();
        
      if (!error && data) {
        setPrivacy(data.user_policies);
      }
    };
    if (visible && !privacy) {
      fetchPrivacy();
    }
  }, [visible, prefetchedPrivacy, privacy]);

  const displayPrivacy = prefetchedPrivacy || privacy;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Privacy Policy</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalHeading, { color: COLORS.saffron }]}>Privacy & Data Protection</Text>
            <Text style={[styles.modalText, { color: theme.textLight }]}>
              {displayPrivacy
                ? displayPrivacy.replace(/^- /gm, '• ')
                : "Loading privacy policy..."}
            </Text>
          </ScrollView>

          <Pressable style={[styles.modalCloseButton, { backgroundColor: COLORS.saffron }]} onPress={onAccept || onClose}>
            <Text style={[styles.modalCloseButtonText, { color: COLORS.buttonText || "#fff" }]}>I Understand</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
    elevation: 1000,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 20,
    zIndex: 1001,
    elevation: 1001,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
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
    textAlign: "justify",
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
});
