import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { COLORS } from "../theme/colors";
import { Service } from "../types/service";

const { width } = Dimensions.get("window");

type Props = {
  service: Service;
  onPress: () => void;
};

export default memo(function ServiceCard({ service, onPress }: Props) {
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();

  return (
    <Pressable
      onPress={() => {
        requestAnimationFrame(() => {
          onPress();
        });
      }}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.background,
          borderColor: theme.border,
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        }
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: service.image }}
          style={styles.image}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
        />
      </View>

      <View style={styles.content}>
        {/* Special Offer Badge */}
        <View style={styles.specialOfferBadge}>
          <Ionicons name="pricetag" size={10} color="#92400E" />
          <Text style={styles.specialOfferText}>Special Offer</Text>
        </View>

        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          style={[styles.title, { color: theme.text }]}
        >
          {service.title}
        </Text>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={12} color={theme.textLight} />
          <Text style={[styles.durationText, { color: theme.textLight }]}>{service.duration}</Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.priceRow}>
            <Text style={[styles.currentPrice, { color: theme.text }]}>
              {String(service.price).startsWith('₹') ? service.price : `₹${service.price}`}
            </Text>
            {service.original_price && Number(String(service.original_price).replace(/[^\d.]/g, '')) > 0 ? (
              <Text style={styles.originalPrice}>
                {String(service.original_price).startsWith('₹') ? service.original_price : `₹${service.original_price}`}
              </Text>
            ) : null}
          </View>

          {/* Card Actions */}
          <View style={styles.cartActionContainer}>
            <View style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    flex: 1,
    marginVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
    backgroundColor: '#F1F5F9', // subtle placeholder color
  },
  image: {
    height: '100%',
    width: '100%',
  },
  specialOfferBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginBottom: 6,
  },
  specialOfferText: {
    color: '#92400E',
    fontSize: 9,
    fontWeight: '800',
  },
  content: {
    padding: 12,
    flex: 1,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: 6,
    lineHeight: 18,
    height: 36, // fix height to align rows
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
    paddingRight: 8,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  priceColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
  },
  currentPrice: {
    fontSize: 15,
    fontWeight: "800",
  },
  originalPrice: {
    fontSize: 11,
    color: "#94A3B8",
    textDecorationLine: "line-through",
    fontWeight: '500',
  },
  cartActionContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  viewButton: {
    backgroundColor: COLORS.saffron,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewButtonText: {
    fontWeight: '700',
    color: '#000000',
    fontSize: 13,
  },
});
