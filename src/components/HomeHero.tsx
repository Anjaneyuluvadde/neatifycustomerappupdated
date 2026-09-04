import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View
} from "react-native";

const { width } = Dimensions.get("window");

interface HomeHeroProps {
  onBookNow?: () => void;
}

export default function HomeHero({ onBookNow }: HomeHeroProps) {
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(15)).current;

  const detailsOpacity = useRef(new Animated.Value(0)).current;
  const detailsTranslateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    // 2. Main Title Text (0.4s, 0.1s delay)
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        delay: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // 3. Supporting Details & Badges (0.4s, 0.2s delay)
    Animated.parallel([
      Animated.timing(detailsOpacity, {
        toValue: 1,
        duration: 400,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(detailsTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }}>
          <Text style={styles.headline}>
            Clean Home,{"\n"}Zero Hassle.
          </Text>
        </Animated.View>

        <Animated.View style={[{ opacity: detailsOpacity, transform: [{ translateY: detailsTranslateY }] }]}>

          <View style={styles.badges}>
            <View style={styles.badge}>
              <Ionicons name="star" size={14} color="#111111" />
              <Text style={styles.badgeText}>4.8 Rating</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={15} color="#111111" />
              <Text style={styles.badgeText}>Verified Pros</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="flash" size={15} color="#111111" />
              <Text style={styles.badgeText}>Reliable Service</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      <Image
        source={require("../../assets/images/heroimg.png")}
        contentFit="contain"
        style={styles.heroImage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    backgroundColor: "#FFC928",
    position: "relative",
    zIndex: 1,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  content: {
    paddingLeft: 20,
    paddingTop: 8,
    paddingBottom: 16,
    zIndex: 2,
    width: width * 0.62,
    justifyContent: 'center',
    height: '100%',
    marginTop: -5,
  },
  headline: {
    fontSize: 22,
    lineHeight: 34,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 10,
    letterSpacing: -0.5,
    fontFamily: "Helvetica Neue",
  },
  ctaButton: {
    backgroundColor: "#0F172A",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 0,
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#111111",
  },
  heroImage: {
    position: "absolute",
    right: -10,
    bottom: -10,
    width: width * 0.55,
    height: 240,
    zIndex: 10,
  },
});
