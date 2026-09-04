import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ServiceInfoCard from './ServiceInfoCard';
import { useLanguage } from '../context/LanguageContext';

interface DescriptionCardProps {
  description: string;
}

const DescriptionCard: React.FC<DescriptionCardProps> = ({ description }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();

  if (!description || !description.trim()) return null;

  const descriptionLines = description
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (descriptionLines.length === 0) return null;

  return (
    <ServiceInfoCard title={t("serviceDetail.description")}>
      {descriptionLines.map((line, index) => (
        <Text
          key={index}
          style={[
            styles.text,
            { color: theme.text, marginTop: index === 0 ? 0 : 8 }
          ]}
        >
          {line}
        </Text>
      ))}
    </ServiceInfoCard>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 15,
    lineHeight: 24,
  },
});

export default DescriptionCard;
