import React from "react";
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { COLORS } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";

type Props = {
    visible: boolean;
    message?: string;
};

/**
 * Full-screen loading overlay with semi-transparent backdrop
 * Prevents user interaction while loading
 */
export default function LoadingOverlay({ visible, message }: Props) {
    const { theme } = useTheme();
    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.background }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    {message && <Text style={[styles.message, { color: theme.text }]}>{message}</Text>}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        justifyContent: "center",
        alignItems: "center",
    },
    container: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        minWidth: 150,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    message: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
        textAlign: "center",
    },
});
