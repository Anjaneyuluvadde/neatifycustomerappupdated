import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "../components/Header";
import ServiceCard from "../components/ServiceCard";

import { useTheme } from "../context/ThemeContext";
import { useBottomNavPadding } from "../hooks/useBottomNavPadding";
import { supabase } from "../lib/supabase";
import { RootStackParamList } from "../navigation/AppNavigator";
import { Service } from "../types/service";

type Props = {
  route: RouteProp<RootStackParamList, "CategoryDetail">;
};

export default function CategoryDetailScreen({ route }: Props) {
  const { category, label } = route.params;
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
      .eq("service_type", category)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching services:", error);
    } else {
      setServices(data || []);
    }
    setLoading(false);
  }, [category]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const renderService = ({ item }: { item: Service }) => (
    <ServiceCard
      service={item}
      onPress={() => navigation.navigate("ServiceDetail", { service: item })}
    />
  );

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
        <Text style={[styles.headerTitle, { color: theme.text }]}>{label}</Text>
        <View style={{ width: 40 }} />
      </View>

      {services.length === 0 && !loading ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>No services found in this category.</Text>
        </View>
      ) : (
        <FlatList
          data={services}
          renderItem={renderService}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={[styles.listContent, bottomNavPadding]}
          showsVerticalScrollIndicator={false}
        />
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
  listContent: {
    padding: 8,
    paddingBottom: 24,
  },
});
