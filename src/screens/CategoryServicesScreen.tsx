import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


import ServiceCard from "../components/ServiceCard";
import { useTheme } from "../context/ThemeContext";
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";
import { supabase } from "../lib/supabase";
import { RootStackParamList } from "../navigation/AppNavigator";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

type Props = {
  route: RouteProp<RootStackParamList, "CategoryServices">;
};

export default function CategoryServicesScreen({ route }: Props) {
  const { mainCategoryName, mainCategoryId, subCategories } = route.params;
  const { theme } = useTheme();
  const bottomNavPadding = useBottomNavPadding();
  const navigation = useNavigation<any>();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("main_category_id", mainCategoryId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching services:", error);
    } else {
      setServices(data || []);
    }
    setLoading(false);
  }, [mainCategoryId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Group services by subcategory
  const groupedServices = subCategories
    .map((cat: any) => ({
      title: cat.label,
      value: cat.value,
      data: services.filter((s) => s.service_type === cat.value),
    }))
    .filter((group) => group.data.length > 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={["top"]}>
      <StatusBar barStyle={theme.background === "#FFFFFF" ? "dark-content" : "light-content"} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: theme.surfaceVariant }]}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{mainCategoryName}</Text>
        <View style={{ width: 40 }} />
      </View>

      {groupedServices.length === 0 && !loading ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>No services found in this category.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, bottomNavPadding]}
        >
          {groupedServices.map((group, index) => (
            <View key={group.value} style={[styles.groupContainer, index > 0 && styles.groupSpacing]}>

              {/* Section Heading */}
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {group.title}
                </Text>
                <View style={[styles.accentLine, { backgroundColor: COLORS.saffron }]} />
              </View>

              {/* Service Cards for this Group */}
              <View style={styles.cardsGrid}>
                {group.data.map((service: Service) => (
                  <View key={service.id} style={styles.cardWrapper}>
                    <ServiceCard
                      service={service}
                      onPress={() => navigation.navigate("ServiceDetail", { service })}
                    />
                  </View>
                ))}
              </View>

            </View>
          ))}
        </ScrollView>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: "center",
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 8,
  },
  groupContainer: {
    width: "100%",
  },
  groupSpacing: {
    marginTop: 32,
  },
  sectionHeader: {
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  accentLine: {
    height: 3,
    width: 40,
    borderRadius: 2,
    marginTop: 4,
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  cardWrapper: {
    width: "48%",
    marginBottom: 8,
  },
});
