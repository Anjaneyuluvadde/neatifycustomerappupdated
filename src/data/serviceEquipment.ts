export interface EquipmentItem {
  name: string;
  icon: string;
}

export interface ServiceEquipmentData {
  subtitle: string;
  items: EquipmentItem[];
}

export const SERVICE_EQUIPMENT = {
  BATHROOM: {
    subtitle: "Professional tools for a spotless bathroom",
    items: [
      { name: "Toilet Brush", icon: "toilet" },
      { name: "Bathroom Scrubber", icon: "brush" },
      { name: "Shower Squeegee", icon: "spray" },
      { name: "Grout Brush", icon: "toothbrush" },
      { name: "Microfiber Cloth", icon: "rectangle-outline" },
      { name: "Disinfectant Spray", icon: "spray-bottle" },
      { name: "Scrub Sponge", icon: "cloud-outline" },
      { name: "Spray Bottle", icon: "spray-bottle" },
    ],
  },
  KITCHEN: {
    subtitle: "Professional tools for a cleaner kitchen",
    items: [
      { name: "Kitchen Scrubber", icon: "bucket-outline" },
      { name: "Degreaser Spray", icon: "spray-bottle" },
      { name: "Microfiber Cloth", icon: "rectangle-outline" },
      { name: "Sponge", icon: "cloud-outline" },
      { name: "Crevice Brush", icon: "toothbrush" },
      { name: "Scraper", icon: "shovel" },
      { name: "Surface Brush", icon: "brush-variant" },
      { name: "Spray Bottle", icon: "spray-bottle" },
    ],
  },
  SOFA: {
    subtitle: "Professional equipment for a deep sofa clean",
    items: [
      { name: "Vacuum Cleaner", icon: "vacuum" },
      { name: "Upholstery Brush", icon: "brush" },
      { name: "Extraction Machine", icon: "cloud-outline" },
      { name: "Microfiber Cloth", icon: "rectangle-outline" },
      { name: "Upholstery Tool", icon: "tools" },
      { name: "Spray Bottle", icon: "spray-bottle" },
    ],
  },
  WINDOW_DOOR: {
    subtitle: "Professional tools for clear windows & doors",
    items: [
      { name: "Glass Squeegee", icon: "spray" },
      { name: "Glass Scrubber", icon: "brush" },
      { name: "Microfiber Cloth", icon: "rectangle-outline" },
      { name: "Window Tool", icon: "tools" },
      { name: "Spray Bottle", icon: "spray-bottle" },
      { name: "Extension Pole", icon: "arrow-up-down" },
      { name: "Glass Scraper", icon: "shovel" },
    ],
  },
  BALCONY: {
    subtitle: "Professional tools for a clean balcony",
    items: [
      { name: "Floor Scrubber", icon: "brush" },
      { name: "Hard Brush", icon: "brush-variant" },
      { name: "Mop", icon: "broom" },
      { name: "Microfiber Cloth", icon: "rectangle-outline" },
      { name: "Spray Bottle", icon: "spray-bottle" },
      { name: "Dustpan & Brush", icon: "delete-sweep" },
      { name: "Deep Cleaner", icon: "cloud-outline" },
    ],
  },
  EXPRESS_HOME: {
    subtitle: "Professional tools for an express home clean",
    items: [
      { name: "Vacuum Cleaner", icon: "vacuum" },
      { name: "Mop", icon: "broom" },
      { name: "Microfiber Cloth", icon: "rectangle-outline" },
      { name: "Dusting Brush", icon: "brush" },
      { name: "Surface Spray", icon: "spray-bottle" },
      { name: "Scrubber", icon: "cloud-outline" },
      { name: "Cleaning Bucket", icon: "pail" },
      { name: "Cleaning Machine", icon: "robot-vacuum" },
    ],
  },
};

/**
 * Robust helper to identify the correct equipment group from the current service.
 */
export const getEquipmentForService = (service: any): ServiceEquipmentData | null => {
  if (!service) return null;

  const type = (service.service_type || "").toUpperCase();
  const title = (service.title || "").toUpperCase();
  const catId = service.main_category_id;

  let detectedGroup = null;

  // Primary identification via main_category_id
  if (catId === "96f9c335-dcde-4f8c-a5b6-146ec924754c") {
    detectedGroup = "BATHROOM";
  } else if (catId === "a7479ade-7fec-4f94-b0d9-db07d9f96c67") {
    detectedGroup = "KITCHEN";
  } else if (catId === "ff612382-f5f8-4b48-8c41-a957d8e83bf2") {
    detectedGroup = "SOFA";
  } else if (catId === "cb133e29-bd5c-4e8d-890f-246e3662b1e9") {
    detectedGroup = "WINDOW_DOOR";
  } else if (catId === "3e1ff2b2-9abb-42e8-a6ce-86217f06a3af") {
    detectedGroup = "BALCONY";
  } else if (catId === "d24f6a4f-8d00-4a5e-8a11-97679e02c4e4") {
    detectedGroup = "EXPRESS_HOME";
  } 
  // Fallback to title/type matching
  else if (type.includes("BATHROOM") || title.includes("BATHROOM")) {
    detectedGroup = "BATHROOM";
  } else if (type.includes("KITCHEN") || title.includes("KITCHEN")) {
    detectedGroup = "KITCHEN";
  } else if (type.includes("SOFA") || title.includes("SOFA")) {
    detectedGroup = "SOFA";
  } else if (type.includes("WINDOW") || type.includes("DOOR") || title.includes("WINDOW") || title.includes("DOOR")) {
    detectedGroup = "WINDOW_DOOR";
  } else if (type.includes("BALCONY") || title.includes("BALCONY")) {
    detectedGroup = "BALCONY";
  } else if (type.includes("EXPRESS") || title.includes("EXPRESS")) {
    detectedGroup = "EXPRESS_HOME";
  }

  const data = detectedGroup ? SERVICE_EQUIPMENT[detectedGroup as keyof typeof SERVICE_EQUIPMENT] : null;

  console.log('[Equipment] CURRENT SERVICE:', service);
  console.log('[Equipment] DETECTED GROUP:', detectedGroup?.toLowerCase() || 'none');
  console.log('[Equipment] EQUIPMENT COUNT:', data?.items?.length || 0);
  
  return data || null;
};
