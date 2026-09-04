import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { COLORS } from '../theme/colors';

interface ServiceInfoCardProps {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  titleColor?: string;
  headerRight?: React.ReactNode;
  style?: any;
}

const ServiceInfoCard: React.FC<ServiceInfoCardProps> = ({ 
  title, 
  icon, 
  children, 
  titleColor,
  headerRight,
  style
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View style={[
      styles.card, 
      { 
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'
      },
      style
    ]}>
      {(title || icon || headerRight) && (
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            {title && (
              <Text style={[
                styles.title, 
                { color: titleColor || theme.text }
              ]}>
                {title}
              </Text>
            )}
          </View>
          {headerRight}
        </View>
      )}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

export default ServiceInfoCard;
