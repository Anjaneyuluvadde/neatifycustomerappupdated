import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface AnimatedGradientBorderProps {
  children: React.ReactNode;
  borderRadius?: number;
  borderWidth?: number;
  animationSpeed?: number;
  style?: ViewStyle;
  flex?: number;
}

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export default function AnimatedGradientBorder({
  children,
  borderRadius = 16,
  borderWidth = 2,
  animationSpeed = 4, // Higher is slower (duration in seconds)
  style,
  flex,
}: AnimatedGradientBorderProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: animationSpeed * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [animationSpeed]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.container, { borderRadius }, style]}>
      {/* The rotating gradient layer */}
      <View style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}>
        <Animated.View
          style={[
            styles.gradientWrapper,
            {
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <LinearGradient
            colors={["#F4C430", "#FCD34D", "#FFFFFF", "#FCD34D", "#F4C430"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          />
        </Animated.View>
      </View>

      {/* The content container (slightly smaller to show border) */}
      <View
        style={[
          styles.content,
          {
            margin: borderWidth,
            borderRadius: Math.max(0, borderRadius - borderWidth),
            flex: flex,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    overflow: "hidden",
    alignSelf: "center", // Help with tight wrapping
  },
  gradientWrapper: {
    width: "300%", // Increased to ensure coverage during rotation
    height: "300%",
    position: "absolute",
    top: "-100%",
    left: "-100%",
  },
  gradient: {
    width: "100%",
    height: "100%",
  },
  content: {
    backgroundColor: "#fff",
    overflow: "hidden",
    flexShrink: 1,
  },
});
