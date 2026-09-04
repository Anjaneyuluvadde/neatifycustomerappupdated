import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { COLORS } from '../theme/colors';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export interface FAQ {
  id: number;
  question: string;
  answer: string;
}

interface FAQItemProps {
  faq: FAQ;
  isActive: boolean;
  onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ faq, isActive, onToggle }) => {
  const { theme, isDark } = useTheme();

  const bgColor = isActive 
    ? (isDark ? "rgba(244, 196, 48, 0.06)" : "#FDFDF6")
    : theme.background;
    
  const borderColor = isActive
    ? "rgba(244, 196, 48, 0.25)"
    : theme.border;

  const leftBorderWidth = isActive ? 5 : 1;
  const leftBorderColor = isActive ? COLORS.saffron : theme.border;

  return (
    <View style={[styles.card, {
      backgroundColor: bgColor,
      borderColor: borderColor,
      borderLeftWidth: leftBorderWidth,
      borderLeftColor: leftBorderColor,
    }]}>
      <Pressable onPress={onToggle} style={styles.header}>
        <View style={styles.questionContainer}>
          <View style={[styles.iconWrapper, { backgroundColor: isActive ? COLORS.saffron : (isDark ? '#333' : '#F3F4F6') }]}>
            <Ionicons name={isActive ? "remove" : "add"} size={14} color={isActive ? "#000" : theme.textLight} />
          </View>
          <Text style={[styles.question, { color: theme.text }]}>
            {faq.question}
          </Text>
        </View>
      </Pressable>
      
      {isActive && (
        <View style={styles.body}>
          <Text style={[styles.answer, { color: theme.textLight }]}>
            {faq.answer}
          </Text>
        </View>
      )}
    </View>
  );
};

interface FAQAccordionProps {
  faqs: FAQ[];
}

const FAQAccordion: React.FC<FAQAccordionProps> = ({ faqs }) => {
  const [openFaqId, setOpenFaqId] = useState<number | null>(faqs.length > 0 ? faqs[0].id : null);

  const handleToggle = (id: number) => {
    // Configure standard layout animation for a smooth, native accordion effect without heavy JS computation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaqId((currentId) => (currentId === id ? null : id));
  };

  if (!faqs || faqs.length === 0) return null;

  return (
    <View style={styles.accordionContainer}>
      {faqs.map((faq) => (
        <FAQItem 
          key={faq.id} 
          faq={faq} 
          isActive={openFaqId === faq.id}
          onToggle={() => handleToggle(faq.id)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  accordionContainer: {
    marginTop: 10,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  question: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    lineHeight: 20,
  },
  body: {
    paddingLeft: 36, // Align with text
    overflow: 'hidden',
    marginTop: 12,
  },
  answer: {
    fontSize: 14,
    lineHeight: 21,
  },
});

export default FAQAccordion;
