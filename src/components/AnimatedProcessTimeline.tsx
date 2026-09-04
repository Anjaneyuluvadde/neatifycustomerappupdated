import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  interpolate,
  Extrapolation,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { COLORS } from '../theme/colors';

export interface TimelineStep {
  title: string;
}

interface AnimatedProcessTimelineProps {
  steps: TimelineStep[];
}

const STEP_DURATION = 1000; // 1 second per step transition

const TimelineNode = ({ 
  index, 
  progress, 
  isDark 
}: { 
  index: number; 
  progress: SharedValue<number>; 
  isDark: boolean; 
}) => {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    pulseScale.value = withRepeat(withTiming(2.5, { duration: 1500, easing: Easing.out(Easing.ease) }), -1, false);
    pulseOpacity.value = withRepeat(withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }), -1, false);
  }, []);

  const outerCircleStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      progress.value,
      [index - 0.5, index, index + 0.5, index + 1],
      [1, 1.2, 1.2, 1],
      Extrapolation.CLAMP
    );
    
    const isCompleted = progress.value >= index + 1;
    const isActiveOrCompleted = progress.value >= index;

    const bgColor = isCompleted 
      ? COLORS.saffron 
      : isDark ? '#222' : '#f9f9f9';

    const borderColor = isActiveOrCompleted 
      ? COLORS.saffron 
      : isDark ? '#444' : '#d1d5db';
      
    const borderWidth = isCompleted ? 0 : 2;

    return {
      transform: [{ scale }],
      backgroundColor: bgColor,
      borderColor: borderColor,
      borderWidth: borderWidth,
    };
  });

  const checkmarkStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [index + 0.8, index + 1],
      [0, 1],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      progress.value,
      [index + 0.8, index + 1],
      [0.5, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ scale }]
    };
  });

  const activeDotStyle = useAnimatedStyle(() => {
    const opacity = progress.value >= index && progress.value < index + 1 ? 1 : 0;
    return { opacity };
  });

  const pulsingDotStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }],
      opacity: pulseOpacity.value,
    };
  });

  return (
    <View style={styles.nodeContainer}>
      <Animated.View style={[styles.outerCircle, outerCircleStyle]}>
        {/* Active Dot and Pulse */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.centerAlign, activeDotStyle]}>
           <Animated.View style={[styles.pulsingDot, pulsingDotStyle]} />
           <View style={styles.innerDot} />
        </Animated.View>
        
        {/* Completed Checkmark */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.centerAlign, checkmarkStyle]}>
           <Ionicons name="checkmark-sharp" size={16} color="#000" />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const TimelineLine = ({ 
  index, 
  progress, 
  isDark 
}: { 
  index: number; 
  progress: SharedValue<number>; 
  isDark: boolean;
}) => {
  const lineFillStyle = useAnimatedStyle(() => {
    const heightPercentage = interpolate(
      progress.value,
      [index, index + 1],
      [0, 100],
      Extrapolation.CLAMP
    );
    return {
      height: `${heightPercentage}%`,
    };
  });

  return (
    <View style={styles.lineContainer}>
      {/* Background dashed line */}
      <View style={[styles.dashedLine, { borderColor: isDark ? '#444' : '#E5E7EB' }]} />
      {/* Animated filled line */}
      <Animated.View style={[styles.filledLine, lineFillStyle]} />
    </View>
  );
};

const AnimatedProcessTimeline: React.FC<AnimatedProcessTimelineProps> = ({ steps }) => {
  const { theme, isDark } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    // Animate through all steps + 1 to complete the last node
    progress.value = withTiming(steps.length, {
      duration: steps.length * STEP_DURATION,
      easing: Easing.linear,
    });
  }, [steps.length]);

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        
        // Item reveal animation
        const itemStyle = useAnimatedStyle(() => {
          const opacity = interpolate(
            progress.value,
            [index - 1, index - 0.5],
            [0, 1],
            Extrapolation.CLAMP
          );
          const translateY = interpolate(
            progress.value,
            [index - 1, index - 0.5],
            [10, 0],
            Extrapolation.CLAMP
          );
          // First item is always visible initially
          return {
            opacity: index === 0 ? 1 : opacity,
            transform: [{ translateY: index === 0 ? 0 : translateY }]
          };
        });

        return (
          <Animated.View key={index} style={[styles.stepRow, itemStyle]}>
            {/* Left Column: Node and Line */}
            <View style={styles.leftColumn}>
              <TimelineNode index={index} progress={progress} isDark={isDark} />
              {!isLast && <TimelineLine index={index} progress={progress} isDark={isDark} />}
            </View>
            
            {/* Right Column: Text */}
            <View style={styles.rightColumn}>
              <Text style={[styles.stepText, { color: theme.text }]}>
                {step.title}
              </Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingLeft: 4,
    paddingRight: 16,
    paddingBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
  },
  leftColumn: {
    alignItems: 'center',
    marginRight: 16,
    width: 32,
  },
  rightColumn: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 24, // spacing between text items
    justifyContent: 'flex-start',
  },
  nodeContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  outerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  centerAlign: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.saffron,
  },
  pulsingDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.saffron,
  },
  lineContainer: {
    width: 2,
    flex: 1,
    // The line stretches between nodes. 
    // Margin top/bottom is slightly handled by padding in rightColumn, but we'll set negative margins to connect circles smoothly
    marginTop: 4,
    marginBottom: 4,
    alignItems: 'center',
  },
  dashedLine: {
    position: 'absolute',
    width: 0,
    height: '100%',
    borderStyle: 'dashed',
    borderLeftWidth: 2,
    borderColor: '#E5E7EB',
  },
  filledLine: {
    width: 2,
    backgroundColor: COLORS.saffron,
    position: 'absolute',
    top: 0,
  },
  stepText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
});

export default AnimatedProcessTimeline;
