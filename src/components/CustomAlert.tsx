import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, Vibration } from "react-native";
import Animated, { 
    FadeIn, 
    FadeOut, 
    SlideInDown, 
    SlideOutDown, 
    useAnimatedStyle, 
    useSharedValue, 
    withSpring,
    withTiming,
    Easing,
    ZoomIn
} from "react-native-reanimated";
import { COLORS } from "../theme/colors";

type AlertType = "success" | "error" | "warning" | "info";

interface CustomAlertProps {
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    onClose: () => void;
    confirmText?: string;
    onConfirm?: () => void;
    cancelText?: string;
    showCancel?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function CustomAlert({
    visible,
    type = "info",
    title,
    message,
    onClose,
    confirmText = "OK",
    onConfirm,
    cancelText = "Cancel",
    showCancel = false,
}: CustomAlertProps) {
    const { width } = useWindowDimensions();

    const handleConfirm = () => {
        if (type === "success") {
            Vibration.vibrate(50);
        }
        onConfirm ? onConfirm() : onClose();
    };

    const getIconName = (): keyof typeof Ionicons.glyphMap => {
        switch (type) {
            case "success": return "checkmark";
            case "error": return "close";
            case "warning": return "alert";
            default: return "information";
        }
    };

    const getIconColor = (): string => {
        // Icon itself is white, the container has the color
        return "#FFFFFF";
    };

    const getIconContainerColor = (): string => {
        switch (type) {
            case "success": return COLORS.success;
            case "error": return COLORS.error;
            case "warning": return "#F4C430";
            default: return COLORS.saffron;
        }
    };

    const getButtonStyle = () => {
        switch (type) {
            case "success": return { backgroundColor: COLORS.success, color: "#FFF" };
            case "error": return { backgroundColor: COLORS.error, color: "#FFF" };
            case "warning": return { backgroundColor: "#F4C430", color: "#111" };
            default: return { backgroundColor: COLORS.saffron, color: "#111" };
        }
    };

    // Button animation hooks
    const primaryScale = useSharedValue(1);
    const primaryStyle = useAnimatedStyle(() => ({ transform: [{ scale: primaryScale.value }] }));
    
    const cancelScale = useSharedValue(1);
    const cancelStyle = useAnimatedStyle(() => ({ transform: [{ scale: cancelScale.value }] }));

    if (!visible) return null;

    const primaryColors = getButtonStyle();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none" // We use Reanimated instead
            onRequestClose={onClose}
        >
            <Animated.View 
                entering={FadeIn.duration(300)} 
                exiting={FadeOut.duration(200)} 
                style={styles.overlay}
            >
                <Animated.View 
                    entering={SlideInDown.duration(400).easing(Easing.out(Easing.back(1.2)))} 
                    exiting={SlideOutDown.duration(300)} 
                    style={[styles.card, { width: Math.min(width * 0.9, 420) }]}
                >
                    {/* Icon */}
                    <Animated.View 
                        entering={ZoomIn.duration(400).delay(100)}
                        style={[styles.iconContainer, { backgroundColor: getIconContainerColor() }]}
                    >
                        <Ionicons name={getIconName()} size={38} color={getIconColor()} />
                    </Animated.View>

                    {/* Content */}
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    {/* Actions */}
                    <View style={styles.actionContainer}>
                        <AnimatedPressable
                            style={[styles.primaryButton, { backgroundColor: primaryColors.backgroundColor }, primaryStyle]}
                            onPressIn={() => { primaryScale.value = withSpring(0.96); }}
                            onPressOut={() => { primaryScale.value = withSpring(1); }}
                            onPress={handleConfirm}
                        >
                            <Text style={[styles.primaryButtonText, { color: primaryColors.color }]}>
                                {confirmText}
                            </Text>
                        </AnimatedPressable>

                        {showCancel && (
                            <AnimatedPressable
                                style={[styles.cancelButton, cancelStyle]}
                                onPressIn={() => { cancelScale.value = withSpring(0.96); }}
                                onPressOut={() => { cancelScale.value = withSpring(1); }}
                                onPress={onClose}
                            >
                                <Text style={styles.cancelButtonText}>{cancelText}</Text>
                            </AnimatedPressable>
                        )}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(17, 17, 17, 0.35)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 28,
        padding: 24,
        alignItems: "center",
        shadowColor: COLORS.saffron,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: "rgba(255, 201, 40, 0.3)", // subtle yellow border
    },
    iconContainer: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
        marginTop: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#111111",
        marginBottom: 12,
        textAlign: "center",
    },
    message: {
        fontSize: 17,
        color: "#555555",
        textAlign: "center",
        marginBottom: 28,
        lineHeight: 24,
        fontWeight: "500",
        paddingHorizontal: 8,
    },
    actionContainer: {
        width: "100%",
        flexDirection: "column",
        gap: 12,
    },
    primaryButton: {
        width: "100%",
        height: 54,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: COLORS.saffron,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: "800",
        letterSpacing: 0.3,
    },
    cancelButton: {
        width: "100%",
        height: 50,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: "#E5E5E5",
    },
    cancelButtonText: {
        color: "#111111",
        fontSize: 16,
        fontWeight: "700",
    },
});
