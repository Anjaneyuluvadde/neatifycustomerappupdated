import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { ServiceEquipmentData } from "../data/serviceEquipment";
import { COLORS } from "../theme/colors";

interface ServiceEquipmentSectionProps {
  equipmentData: ServiceEquipmentData | null;
}

export default function ServiceEquipmentSection({ equipmentData }: ServiceEquipmentSectionProps) {
  const { theme, isDark } = useTheme();

  // If no equipment data is found for the service, hide the section completely.
  if (!equipmentData || !equipmentData.items || equipmentData.items.length === 0) {
    return null;
  }

  return (
    <View style={{ marginBottom: 32 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 4 }}>
        Our Cleaning Tools & Equipment
      </Text>
      <Text style={{ fontSize: 14, color: theme.textLight, marginBottom: 16 }}>
        {equipmentData.subtitle}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {equipmentData.items.slice(0, 4).map((tool, idx) => (
          <View
            key={idx}
            style={{
              width: "48%",
              backgroundColor: theme.surface,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              marginBottom: 12,
              borderWidth: 1,
              borderColor: theme.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View style={{ marginBottom: 8 }}>
              <MaterialCommunityIcons name={tool.icon as any} size={28} color={theme.text} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text, textAlign: "center" }}>
              {tool.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
