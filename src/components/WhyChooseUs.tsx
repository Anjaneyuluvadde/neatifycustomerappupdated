import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

interface WhyChooseUsProps {
  onBookNow?: () => void;
}

interface Feature {
  icon: string;
  iconFamily: 'Ionicons' | 'MaterialCommunityIcons';
  title: string;
  description: string;
}

interface WhyChooseUsData {
  title: string;
  subtitle: string;
  features: Feature[];
  bottom_title: string;
  bottom_desc: string;
  bottom_button_text: string;
}

const DEFAULT_DATA: WhyChooseUsData = {
  title: "Why Choose Neatify?",
  subtitle: "We make home services simple, reliable and stress-free.",
  features: [
    { icon: "shield-check-outline", iconFamily: "MaterialCommunityIcons", title: "Verified & Trained Professionals", description: "Skilled experts you can trust." },
    { icon: "pricetag-outline", iconFamily: "Ionicons", title: "Transparent Pricing", description: "No hidden charges. Pay what you see." },
    { icon: "time-outline", iconFamily: "Ionicons", title: "On-Time Service", description: "Punctual and reliable service at your doorstep." },
    { icon: "happy-outline", iconFamily: "Ionicons", title: "Customer Satisfaction", description: "We ensure quality service every time." },
  ],
  bottom_title: "Sparkling Clean in a Flash ⚡",
  bottom_desc: "Short on time? Let our top-rated professionals refresh your home instantly with our signature Express Cleaning service.",
  bottom_button_text: "Book Express Clean Now"
};

export default function WhyChooseUs({ onBookNow }: WhyChooseUsProps) {
  const { theme } = useTheme();
  const [data, setData] = useState<WhyChooseUsData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data: supabaseData, error } = await supabase
          .from('why_choose_us_content')
          .select('*')
          .eq('is_active', true)
          .single();

        if (error) throw error;
        
        if (supabaseData) {
          setData(supabaseData as WhyChooseUsData);
        }
      } catch (err) {
        console.log("Using default WhyChooseUs content. Set up table in Supabase to make it dynamic.", err);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  const renderIcon = (feature: Feature) => {
    if (feature.iconFamily === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={feature.icon as any} size={24} color={COLORS.saffron} />;
    }
    return <Ionicons name={feature.icon as any} size={24} color={COLORS.saffron} />;
  };

  if (loading) {
    return (
      <View style={[styles.container, { minHeight: 200, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.saffron} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Section */}
      <View style={[styles.topSection, { backgroundColor: theme.surfaceVariant }]}>
        <View style={styles.topHeader}>
          <Text style={[styles.title, { color: theme.text }]}>{data.title}</Text>
          <Text style={[styles.subtitle, { color: theme.textLight }]}>{data.subtitle}</Text>
        </View>

        <View style={styles.featuresContainer}>
          {data.features?.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.saffron + '20' }]}>
                {renderIcon(feature)}
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={[styles.featureTitle, { color: theme.text }]}>{feature.title}</Text>
                <Text style={[styles.featureDesc, { color: theme.textLight }]}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { backgroundColor: COLORS.saffron }]}>
        <View style={styles.bottomContent}>
          <Text style={styles.bottomTitle}>{data.bottom_title}</Text>
          <Text style={styles.bottomDesc}>{data.bottom_desc}</Text>
          
          <Pressable style={[styles.bookBtn, { backgroundColor: '#1A1A1A' }]} onPress={onBookNow}>
            <Text style={[styles.bookBtnText, { color: '#FFF' }]}>{data.bottom_button_text}</Text>
          </Pressable>
        </View>
        
        {/* Mockup or Illustration Element */}
        <View style={styles.mockupContainer}>
          <Ionicons name="sparkles" size={40} color="rgba(255,255,255,0.4)" style={styles.sparkle1} />
          <Ionicons name="sparkles" size={24} color="rgba(255,255,255,0.3)" style={styles.sparkle2} />
          <Ionicons name="phone-portrait-outline" size={140} color="rgba(255,255,255,0.2)" style={styles.phoneIcon} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 24,
    paddingHorizontal: 16,
  },
  topSection: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
  },
  topHeader: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  featuresContainer: {
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  bottomSection: {
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 200,
  },
  bottomContent: {
    flex: 1,
    zIndex: 2,
    justifyContent: 'center',
    paddingRight: 40,
  },
  bottomTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  bottomDesc: {
    fontSize: 15,
    color: '#1A1A1A',
    opacity: 0.8,
    marginBottom: 24,
    lineHeight: 22,
  },
  bookBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  bookBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
  mockupContainer: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    zIndex: 1,
    width: 140,
    height: 200,
  },
  phoneIcon: {
    position: 'absolute',
    right: 0,
    bottom: -20,
    transform: [{ rotate: '15deg' }],
  },
  sparkle1: {
    position: 'absolute',
    top: 20,
    left: -20,
  },
  sparkle2: {
    position: 'absolute',
    top: 100,
    left: 20,
  }
});
