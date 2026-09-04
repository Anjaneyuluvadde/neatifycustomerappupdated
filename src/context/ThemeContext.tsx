import AsyncStorage from "@react-native-async-storage/async-storage";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Platform } from "react-native";

interface ThemeColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  primary: string;
  text: string;
  textMuted: string;
  textLight: string;
  border: string;
  error: string;
}

interface ThemeContextType {
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const lightTheme: ThemeColors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceVariant: "#F3F4F6",
  primary: "#F4C430",
  text: "#1F2937",
  textMuted: "#6B7280",
  textLight: "#9CA3AF",
  border: "#E5E7EB",
  error: "#EF4444",
};

const darkTheme: ThemeColors = {
  background: "#111827",
  surface: "#1F2937",
  surfaceVariant: "#374151",
  primary: "#F4C430",
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  textLight: "#6B7280",
  border: "#374151",
  error: "#F87171",
};

const THEME_STORAGE_KEY = "@theme_mode";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  // Update navigation bar and status bar on Android when theme changes
  // In Android 15+ (SDK 35), edge-to-edge is enforced, so background and position 
  // settings are ignored (transparent by default).
  useEffect(() => {
    if (isLoaded && Platform.OS === "android") {
      const updateSystemUI = async () => {
        try {
          const themeColors = isDark ? darkTheme : lightTheme;
          
          // Set root view background color so it shows through transparent navigation bar
          await SystemUI.setBackgroundColorAsync(themeColors.background);

          // Update the button style (icons) to be visible on the background
          await NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");
        } catch (e) {
          console.error("Failed to update system UI:", e);
        }
      };
      updateSystemUI();
    }
  }, [isDark, isLoaded]);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme !== null) {
        setIsDark(savedTheme === "dark");
      }
    } catch (e) {
      console.error("Failed to load theme:", e);
    } finally {
      setIsLoaded(true);
    }
  };

  const toggleTheme = async () => {
    try {
      const newMode = !isDark;
      setIsDark(newMode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode ? "dark" : "light");
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  // Prevent flash by waiting for theme to load from storage
  // If not loaded, we can still render children but with default (light) or a loader
  // Given we want to avoid flashes, rendering children ONLY after load is safer
  if (!isLoaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

