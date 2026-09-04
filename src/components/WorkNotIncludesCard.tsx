import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ServiceInfoCard from './ServiceInfoCard';

interface WorkNotIncludesCardProps {
  workNotIncludes: string | null | undefined;
}

const RED_ACCENT = '#EF4444'; // Tailwind Red 500
const RED_BG_LIGHT = '#FEF2F2'; // Tailwind Red 50
const RED_BORDER_LIGHT = '#FCA5A5'; // Tailwind Red 300

const WorkNotIncludesCard: React.FC<WorkNotIncludesCardProps> = ({ workNotIncludes }) => {
  const { theme, isDark } = useTheme();

  if (!workNotIncludes || !workNotIncludes.trim()) return null;

  const notIncludesLines = workNotIncludes
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (notIncludesLines.length === 0) return null;

  return (
    <ServiceInfoCard 
      title="Work Not Includes"
      titleColor={RED_ACCENT}
      icon={<Ionicons name="close-circle" size={24} color={RED_ACCENT} />}
      style={{
        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.05)' : RED_BG_LIGHT,
        borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : RED_BORDER_LIGHT,
      }}
    >
      <View style={styles.list}>
        {notIncludesLines.map((line, index) => {
          // Strip existing manual bullets if any
          const cleanLine = line.replace(/^[•\-\*]\s*/, "");
          return (
            <View key={index} style={styles.listItem}>
              <Ionicons 
                name="close" 
                size={18} 
                color={RED_ACCENT} 
                style={styles.closeIcon} 
              />
              <Text style={[styles.text, { color: isDark ? theme.textLight : '#7F1D1D' }]}>
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
  closeIcon: {
    marginRight: 10,
    marginTop: 2, // slightly lower to align with text
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    flex: 1,
  },
});

export default WorkNotIncludesCard;
