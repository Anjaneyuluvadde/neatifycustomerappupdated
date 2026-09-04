import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { cartItems, removeFromCart, clearCart, loadingCart, fetchCart } = useCart();
  const { theme, isDark } = useTheme();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchCart();
    setRefreshing(false);
  }, [fetchCart]);

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const num = Number((item.price || "").replace(/[^\d]/g, ""));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [cartItems]);

  // ✅ Convert cart items to SelectedService[] for Schedule screen
  const servicesForSchedule = useMemo(() => {
    return cartItems.map((item) => ({
      id: item.service_id,
      title: item.title,
      duration: item.duration,
      price: item.price,
      image: item.image,
    }));
  }, [cartItems]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* HEADER */}
      <View
        style={{
          paddingTop: 14,
          paddingHorizontal: 16,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderColor: theme.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: theme.background,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "900", color: theme.text }}>
          My Cart
        </Text>

        {cartItems.length > 0 ? (
          <Pressable onPress={clearCart}>
            <Text style={{ fontWeight: "800", color: "#dc2626" }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {cartItems.length === 0 && !loadingCart ? (
        /* ✅ EMPTY CART */
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="cart-outline" size={50} color={theme.textLight} />
          <Text style={{ marginTop: 12, fontSize: 16, color: theme.textLight }}>
            Your cart is empty
          </Text>

          <Pressable
            onPress={() => navigation.navigate("HomeDrawer")}
            style={{
              marginTop: 16,
              backgroundColor: theme.primary,
              paddingVertical: 12,
              paddingHorizontal: 20,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontWeight: "900", color: theme.background }}>
              Browse Services
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* CART LIST */}
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.primary]}
                tintColor={theme.primary}
                progressBackgroundColor={theme.background}
              />
            }
          >
            {/* ✅ Add more services */}
            <Pressable
              onPress={() => navigation.navigate("HomeDrawer")}
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <Text style={{ fontWeight: "900", color: theme.text }}>
                + Add More Services
              </Text>
            </Pressable>

            {cartItems.map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  gap: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 16,
                  padding: 12,
                  marginBottom: 14,
                  backgroundColor: theme.background,
                }}
              >
                {/* IMAGE */}
                {item.image && item.image.trim() !== '' ? (
                  <Image
                    source={{ uri: item.image }}
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: 16,
                      backgroundColor: theme.surfaceVariant,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: 16,
                      backgroundColor: theme.surfaceVariant,
                    }}
                  />
                )}

                {/* DETAILS */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontWeight: "900",
                      fontSize: 16,
                      color: theme.text,
                    }}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  <Text style={{ marginTop: 5, color: theme.textLight }}>
                    {item.duration}
                  </Text>

                  <Text
                    style={{
                      marginTop: 6,
                      fontWeight: "900",
                      fontSize: 16,
                      color: theme.text,
                    }}
                  >
                    {item.price}
                  </Text>

                  {/* ✅ Remove Button */}
                  <Pressable
                    onPress={() => removeFromCart(item.service_id)}
                    style={{ marginTop: 10 }}
                  >
                    <Text style={{ color: "#dc2626", fontWeight: "900" }}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* ✅ BOTTOM FOOTER */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: theme.background,
              padding: 16,
              borderTopWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontWeight: "900", fontSize: 16, color: theme.text }}>Total</Text>
              <Text style={{ fontWeight: "900", fontSize: 16, color: theme.text }}>₹{total}</Text>
            </View>

            <Pressable
              onPress={() => {
                navigation.navigate("Schedule", {
                  services: servicesForSchedule,
                });
              }}
              style={{
                backgroundColor: theme.primary,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: theme.background, fontWeight: "900", fontSize: 16 }}>
                Continue Booking
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
