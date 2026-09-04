import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextStyle,
    ViewStyle
} from "react-native";
import { COLORS } from "../theme/colors";

type Props = {
    title: string;
    onPress: () => void | Promise<void>;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    variant?: "primary" | "secondary";
};

/**
 * Reusable button with built-in loading state
 * Automatically disables during loading to prevent multiple clicks
 */
export default function LoadingButton({
    title,
    onPress,
    loading = false,
    disabled = false,
    style,
    textStyle,
    variant = "primary",
}: Props) {
    const isDisabled = loading || disabled;

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            style={[
                styles.button,
                variant === "primary" ? styles.primary : styles.secondary,
                isDisabled && styles.disabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator
                    color={variant === "primary" ? COLORS.buttonText : COLORS.saffron}
                />
            ) : (
                <Text
                    style={[
                        styles.text,
                        variant === "primary" ? styles.primaryText : styles.secondaryText,
                        isDisabled && styles.disabledText,
                        textStyle,
                    ]}
                >
                    {title}
                </Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
    },
    primary: {
        backgroundColor: COLORS.saffron,
    },
    secondary: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: COLORS.saffron,
    },
    disabled: {
        opacity: 0.6,
    },
    text: {
        fontSize: 16,
        fontWeight: "700",
    },
    primaryText: {
        color: COLORS.buttonText,
    },
    secondaryText: {
        color: COLORS.saffron,
    },
    disabledText: {
        opacity: 0.7,
    },
});
