import React, { useState, useRef, useEffect } from "react";
import { View, FlatList, Dimensions, StyleSheet, Animated, Pressable } from "react-native";
import { Image } from "expo-image";

const { width } = Dimensions.get("window");

export interface PromotionalBanner {
  offer_percentage?: number;
  service_scope?: string;
  customer_type?: string;
  pincode_scope?: string;
  id: string;
  image_url: string;
  is_active: boolean;
  display_order: number;
}

interface PromotionalBannerSliderProps {
  onBannerPress?: (banner: PromotionalBanner) => void;
  banners: PromotionalBanner[];
  theme: any;
}

export default function PromotionalBannerSlider({ banners, theme, onBannerPress }: PromotionalBannerSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // We measure the first image's aspect ratio and apply it to ALL banners
  // to ensure a perfectly consistent container height and prevent jumping.
  const [globalRatio, setGlobalRatio] = useState<number | null>(null);


  const handleOnScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
    }
  );

  const handleOnViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const paddingHorizontal = 16;
  const itemWidth = width - paddingHorizontal * 2;
  const activeRatio = globalRatio || (21 / 9);

  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Animated.FlatList
        data={banners}
        horizontal
        pagingEnabled
        snapToAlignment="center"
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={handleOnScroll}
        onViewableItemsChanged={handleOnViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item, index) => item.id + index.toString()}
        removeClippedSubviews={false}
        renderItem={({ item, index }) => {
          return (
            <View style={{ width, paddingHorizontal, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: itemWidth, height: itemWidth / activeRatio, borderRadius: 12, overflow: 'hidden' }}>
                <Pressable onPress={() => { console.log("[PROMO] Banner pressed"); console.log("[PROMO] Banner ID:", item.id); console.log("[PROMO] Offer percentage:", item.offer_percentage); onBannerPress && onBannerPress(item); }} style={{ flex: 1 }}>
                  <Image
                  source={{ uri: item.image_url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={300}
                  onLoad={(e) => {
                    // Only use the first banner's ratio to dictate the entire slider's height
                    if (index === 0 && !globalRatio) {
                      const imgWidth = e.source.width;
                      const imgHeight = e.source.height;
                      if (imgWidth && imgHeight) {
                        setGlobalRatio(imgWidth / imgHeight);
                      }
                    }
                  }}
                />
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {/* Pagination Dots */}
      {banners.length > 1 && (
        <View style={styles.paginationContainer}>
          {banners.map((_, idx) => {
            const inputRange = [
              (idx - 1) * width,
              idx * width,
              (idx + 1) * width,
            ];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [6, 16, 6],
              extrapolate: "clamp",
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={idx.toString()}
                style={[
                  styles.dot,
                  { width: dotWidth, opacity, backgroundColor: theme.text },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 24,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
});





