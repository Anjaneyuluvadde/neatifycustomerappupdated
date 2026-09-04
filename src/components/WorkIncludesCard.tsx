import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ServiceInfoCard from './ServiceInfoCard';
import { COLORS } from '../theme/colors';
import { useLanguage } from '../context/LanguageContext';

interface WorkIncludesCardProps {
  workIncludes: string | null | undefined;
}

const WorkIncludesCard: React.FC<WorkIncludesCardProps> = ({ workIncludes }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();

  if (!workIncludes || !workIncludes.trim()) return null;

  const includesLines = workIncludes
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (includesLines.length === 0) return null;

  return (
    <ServiceInfoCard 
      title={t("serviceDetail.includes")}
      titleColor={COLORS.saffron}
      icon={<Ionicons name="checkmark-circle" size={24} color={COLORS.saffron} />}
    >
      <View style={styles.list}>
        {includesLines.map((line, index) => {
          // Strip existing manual bullets if any
          const cleanLine = line.replace(/^[•\-\*]\s*/, "");
          return (
            <View key={index} style={styles.listItem}>
              <Ionicons 
                name="checkmark" 
                size={18} 
                color={COLORS.saffron} 
                style={styles.checkIcon} 
              />
              <Text style={[styles.text, { color: theme.text }]}>
                {cleanLine}
              </Text>
            </View>
          );
        })}
      </View>
    </ServiceInfoCard>
  );
};

const styles = StyleSheet.create({
  list: {
    marginTop: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  checkIcon: {
    marginRight: 10,
    marginTop: 2, // slightly lower to align with text
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    flex: 1,
  },
});

export default WorkIncludesCard;
