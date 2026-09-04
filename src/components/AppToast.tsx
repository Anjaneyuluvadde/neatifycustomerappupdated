import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";

type Props = {
  visible: boolean;
  message: string;
  type?: "success" | "error" | "info";
  onHide: () => void;
};

export default function AppToast({
  visible,
  message,
  type = "success",
  onHide,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(25)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 25,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => onHide());
    }, 1500);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const bg =
    type === "success" ? "#16a34a" : type === "error" ? "#dc2626" : "#0f172a";

  const icon =
    type === "success"
      ? "checkmark-circle"
      : type === "error"
      ? "close-circle"
      : "information-circle";

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 18,
        left: 16,
        right: 16,
        backgroundColor: bg,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity,
        transform: [{ translateY }],
        zIndex: 999,
      }}
    >
      <Ionicons name={icon as any} size={20} color="#fff" />

      <Text
        style={{
          flex: 1,
          color: "#fff",
          fontWeight: "700",
          fontSize: 14.5,
        }}
        numberOfLines={2}
      >
        {message}
      </Text>
    </Animated.View>
  );
}
