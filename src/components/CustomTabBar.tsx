import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";

const { width } = Dimensions.get("window");

// Creates the curved notched background for the floating tab bar
const TabBarBackground = ({ bgColor, shadowColor, isDark }: { bgColor: string, shadowColor: string, isDark: boolean }) => {
  const W = width - 40; // 20px margin on each side
  const H = 70;
  const cx = W / 2;

  // Custom SVG path for rounded rectangle with a top-center dip (notch)
  const path = `
    M 24,0
    L ${cx - 45},0
    C ${cx - 20},0 ${cx - 30},38 ${cx},38
    C ${cx + 30},38 ${cx + 20},0 ${cx + 45},0
    L ${W - 24},0
    Q ${W},0 ${W},24
    L ${W},${H - 24}
    Q ${W},${H} ${W - 24},${H}
    L 24,${H}
    Q 0,${H} 0,${H - 24}
    L 0,24
    Q 0,0 24,0
    Z
  `;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={W} height={H} style={styles.svgShadow}>
        {/* We can add a drop shadow filter in SVG, or rely on View elevation */}
        <Path d={path} fill={bgColor} />
      </Svg>
    </View>
  );
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Extract the original 3 routes
  const homeRoute = state.routes.find(r => r.name === "HomeTab");
  const bookingsRoute = state.routes.find(r => r.name === "MyBookingsTab");
  const profileRoute = state.routes.find(r => r.name === "ProfileTab");

  const scaleAnims = useRef(state.routes.map(() => new Animated.Value(1))).current;

  // Define our 3 visual items
  const tabs = [
    { type: "route", route: bookingsRoute, icon: "calendar", label: "Bookings", index: 1 },
    { type: "route", route: homeRoute, icon: "home", label: "Home", isCenter: true, index: 0 },
    { type: "route", route: profileRoute, icon: "person", label: "Profile", index: 2 }
  ];

  const centerScale = useRef(new Animated.Value(1)).current;

  const handleCenterPressIn = () => {
    Animated.spring(centerScale, {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handleCenterPressOut = () => {
    Animated.spring(centerScale, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 12,
      speed: 20,
    }).start();
  };

  useEffect(() => {
    // Animate all standard tabs based on the active state.index
    scaleAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: state.index === i ? 1.1 : 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  }, [state.index, scaleAnims]);

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 15 }]}>
      <View style={[styles.container, {
        shadowColor: isDark ? "#000" : "#999",
      }]}>
        <TabBarBackground bgColor={theme.background} shadowColor={theme.border} isDark={isDark} />

        <View style={styles.content}>
          {tabs.map((tab, i) => {
            const isCenter = tab.isCenter;
            const isRoute = tab.type === "route" && tab.route;

            // For the standard tabs, we find their real route index in state.routes to determine if they are focused
            const routeIndex = isRoute ? state.routes.findIndex((r: any) => r.key === tab.route?.key) : -1;
            const isFocused = routeIndex !== -1 ? state.index === routeIndex : false;

            const scaleAnim = routeIndex !== -1 ? scaleAnims[routeIndex] : new Animated.Value(1);

            // Animate on focus change (we can do this safely inside map because we are just calling start() on the ref, 
            // though the cleanest way is a useEffect that watches state.index). 
            // Let's use useEffect in the parent to drive all animations based on state.index.

            const onPress = () => {
              if (isRoute && tab.route) {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: tab.route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(tab.route.name, tab.route.params);
                }
              }
            };

            if (isCenter) {
              return (
                <View key={`center-${i}`} style={styles.centerButtonWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={handleCenterPressIn}
                    onPressOut={handleCenterPressOut}
                    onPress={onPress}
                  >
                    <Animated.View style={[
                      styles.centerButton,
                      {
                        backgroundColor: isFocused ? theme.primary : (isDark ? '#374151' : '#F3F4F6'),
                        transform: [{ scale: centerScale }]
                      },
                      (isFocused && isDark) ? { shadowColor: theme.primary, shadowOpacity: 0.5, shadowRadius: 10 } : {}
                    ]}>
                      <FontAwesome5
                        name="home"
                        size={26}
                        color={isFocused ? theme.background : (isDark ? theme.textLight : "#9CA3AF")}
                        solid={isFocused}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              );
            }

            const color = isFocused ? theme.primary : (isDark ? theme.textLight : "#9CA3AF");

            return (
              <TouchableOpacity
                key={`tab-${i}`}
                activeOpacity={0.7}
                onPress={onPress}
                style={styles.tabItem}
              >
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  {tab.icon === "home" ? (
                    <FontAwesome5 name="home" size={22} color={color} solid={isFocused} />
                  ) : (
                    <Ionicons
                      name={isFocused ? (tab.icon as any) : `${tab.icon}-outline` as any}
                      size={24}
                      color={color}
                    />
                  )}
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  container: {
    width: Dimensions.get("window").width - 40,
    height: 70,
    flexDirection: "row",
    // View elevation for Android shadow
    elevation: 10,
    // iOS shadow
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  svgShadow: {
    // If we want additional SVG shadow processing, though parent container shadow usually handles it
  },
  content: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  centerButtonWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    top: -25, // Raise the button above the bar
    // Shadow for center button
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
