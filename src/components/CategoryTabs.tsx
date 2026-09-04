import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { COLORS } from "../theme/colors";
import { useTheme } from "../context/ThemeContext";

type Tab = { label: string; value: string };

interface CategoryTabsProps {
  activeTab: string;
  onChange: (value: string) => void;
  tabs: Tab[];
}

// ✅ Comprehensive icon map — keys are UPPERCASE service_type values
const CATEGORY_ICONS: Record<string, { provider: "Ionicons" | "MaterialCommunityIcons"; name: any }> = {
  BATHROOM: { provider: "MaterialCommunityIcons", name: "shower" },
  KITCHEN: { provider: "Ionicons", name: "restaurant-outline" },
  HOUSE: { provider: "Ionicons", name: "home-outline" },
  BALCONY: { provider: "Ionicons", name: "sunny-outline" },
  GARDEN: { provider: "Ionicons", name: "leaf-outline" },
  OFFICE: { provider: "Ionicons", name: "business-outline" },
  LAUNDRY: { provider: "Ionicons", name: "shirt-outline" },
  CARPET: { provider: "Ionicons", name: "layers-outline" },
  WINDOW: { provider: "Ionicons", name: "grid-outline" },
  FLOOR: { provider: "Ionicons", name: "footsteps-outline" },
  SOFA: { provider: "Ionicons", name: "bed-outline" },
  BALCONY_CLEANING: { provider: "Ionicons", name: "sunny-outline" },
  KITCHEN_CLEANING: { provider: "Ionicons", name: "restaurant-outline" },
  BATHROOM_CLEANING: { provider: "MaterialCommunityIcons", name: "shower" },
  HOUSE_CLEANING: { provider: "Ionicons", name: "home-outline" },
  FULL_HOME: { provider: "Ionicons", name: "home-outline" },
  FULL_HOUSE: { provider: "Ionicons", name: "home-outline" },
  DEEP_CLEANING: { provider: "MaterialCommunityIcons", name: "vacuum" },
  DEEP: { provider: "MaterialCommunityIcons", name: "vacuum" },
  CLEANING: { provider: "Ionicons", name: "sparkles-outline" },
  MOVE_IN: { provider: "Ionicons", name: "enter-outline" },
  MOVE_OUT: { provider: "Ionicons", name: "exit-outline" },
  OTHER_SERVICES: { provider: "Ionicons", name: "construct-outline" },
  OTHER: { provider: "Ionicons", name: "construct-outline" },
  PEST_CONTROL: { provider: "Ionicons", name: "bug-outline" },
  AC_SERVICE: { provider: "Ionicons", name: "snow-outline" },
  PAINTING: { provider: "Ionicons", name: "color-palette-outline" },
  PLUMBING: { provider: "Ionicons", name: "build-outline" },
  ELECTRICAL: { provider: "Ionicons", name: "flash-outline" },
  SANITIZATION: { provider: "Ionicons", name: "shield-checkmark-outline" },
  MARBLE: { provider: "Ionicons", name: "diamond-outline" },
  TANK: { provider: "Ionicons", name: "beaker-outline" },
  WATER_TANK: { provider: "Ionicons", name: "beaker-outline" },
  ALL: { provider: "Ionicons", name: "apps-outline" },
};

const getIconForCategory = (value: string) => {
  const upper = value.toUpperCase();
  if (CATEGORY_ICONS[upper]) return CATEGORY_ICONS[upper];

  // Partial match
  const normalizedUpper = upper.replace(/[\s_-]/g, "");
  for (const [key, iconInfo] of Object.entries(CATEGORY_ICONS)) {
    const normalizedKey = key.replace(/[\s_-]/g, "");
    if (normalizedUpper.includes(normalizedKey) || normalizedKey.includes(normalizedUpper)) {
      return iconInfo;
    }
  }
  return null;
};

export default function CategoryTabs({ activeTab, onChange, tabs }: CategoryTabsProps) {
  const { theme } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const tabLayouts = useRef<Record<number, { width: number; x: number }>>({});
  const { width: SCREEN_WIDTH } = Dimensions.get("window");

  // ✅ Auto-scroll to center the active tab precisely
  useEffect(() => {
    const idx = tabs.findIndex((t) => t.value === activeTab);
    if (idx >= 0 && scrollRef.current) {
      setTimeout(() => {
        if (tabLayouts.current[idx] && scrollRef.current) {
          const layout = tabLayouts.current[idx];
          const scrollX = Math.max(0, layout.x - (SCREEN_WIDTH / 2) + (layout.width / 2));
          scrollRef.current.scrollTo({ x: scrollX, animated: true });
        } else if (scrollRef.current) {
          const estimatedTabWidth = 140;
          const scrollX = Math.max(0, idx * estimatedTabWidth - 100);
          scrollRef.current.scrollTo({ x: scrollX, animated: true });
        }
      }, 50);
    }
  }, [activeTab, tabs]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.value === activeTab;
          const icon = getIconForCategory(tab.value);

          return (
            <View 
              key={tab.value}
              onLayout={(e) => {
                tabLayouts.current[index] = e.nativeEvent.layout;
              }}
            >
              <TabItem
                tab={tab}
                icon={icon}
                isActive={isActive}
                theme={theme}
                onPress={() => onChange(tab.value)}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const TabItem = React.memo(({ tab, icon, isActive, theme, onPress }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.tab,
          isActive
            ? styles.tabActive
            : { backgroundColor: theme.surfaceVariant, borderColor: theme.border },
        ]}
      >
        {icon && (
          icon.provider === "Ionicons" ? (
            <Ionicons name={icon.name} size={16} color={isActive ? "#000" : theme.textLight} style={styles.icon} />
          ) : (
            <MaterialCommunityIcons name={icon.name} size={18} color={isActive ? "#000" : theme.textLight} style={styles.icon} />
          )
        )}
        <Text style={[styles.tabText, isActive ? styles.tabTextActive : { color: theme.textMuted }]}>
          {tab.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: "center",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  tabActive: {
    backgroundColor: COLORS.saffron,
    borderColor: COLORS.saffron,
    elevation: 4,
    shadowColor: COLORS.saffron,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  tabInactive: {
  },
  icon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#000",
    fontWeight: "700",
  },
  tabTextInactive: {
    color: COLORS.gray,
  },
});
