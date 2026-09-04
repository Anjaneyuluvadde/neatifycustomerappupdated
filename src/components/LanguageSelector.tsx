import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { COLORS } from "../theme/colors";

export default function LanguageSelector() {
    const { language, setLanguage, t } = useLanguage();
    const [modalVisible, setModalVisible] = useState(false);

    const languages = [
        { code: "en", label: "English", native: "English" },
        { code: "te", label: "Telugu", native: "తెలుగు" },
        { code: "hi", label: "Hindi", native: "हिंदी" },
    ];

    const handleSelect = (code: string) => {
        setLanguage(code as any);
        setModalVisible(false);
    };

    return (
        <View>
            <Pressable
                style={styles.trigger}
                onPress={() => setModalVisible(true)}
            >
                <Ionicons name="language" size={20} color={COLORS.saffron} />
                <Text style={styles.triggerText}>
                    {languages.find((l) => l.code === language)?.native || "English"}
                </Text>
            </Pressable>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable
                    style={styles.overlay}
                    onPress={() => setModalVisible(false)}
                >
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Select Language</Text>

                            {languages.map((lang) => (
                                <Pressable
                                    key={lang.code}
                                    style={[
                                        styles.option,
                                        language === lang.code && styles.selectedOption,
                                    ]}
                                    onPress={() => handleSelect(lang.code)}
                                >
                                    <Text
                                        style={[
                                            styles.optionText,
                                            language === lang.code && styles.selectedOptionText,
                                        ]}
                                    >
                                        {lang.native} ({lang.label})
                                    </Text>
                                    {language === lang.code && (
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                    )}
                                </Pressable>
                            ))}

                            <Pressable
                                style={styles.closeBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.closeText}>Cancel</Text>
                            </Pressable>
                        </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    trigger: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        padding: 8,
        borderRadius: 8,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#eee",
    },
    triggerText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#333",
    },
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end", // Bottom sheet style
    },
    modalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        gap: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 12,
        textAlign: "center",
    },
    option: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderRadius: 12,
        backgroundColor: "#f5f5f5",
        borderWidth: 1,
        borderColor: "transparent",
    },
    selectedOption: {
        backgroundColor: COLORS.saffron,
        borderColor: COLORS.saffron,
    },
    optionText: {
        fontSize: 16,
        fontWeight: "500",
        color: "#333",
    },
    selectedOptionText: {
        color: "#fff",
        fontWeight: "700",
    },
    closeBtn: {
        marginTop: 8,
        padding: 16,
        alignItems: "center",
    },
    closeText: {
        color: "#eb5a46", // red/orange
        fontWeight: "600",
        fontSize: 16,
    },
});
