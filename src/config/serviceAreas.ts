export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface ServiceHub {
  id: string;
  name: string;
  center: Coordinate;
  radiusKm: number; // Fallback radius in kilometers if polygon is not defined
  polygon?: Coordinate[]; // Polygon boundaries (to be populated later)
}

export interface ServiceArea {
  id: string;
  name: string;
  hubId: string;
  pinCodes: string[];
  polygon?: Coordinate[]; // Verified precise boundary
  center?: Coordinate;    // Temporary fallback coordinate
  radiusKm?: number;      // Temporary fallback radius
}

// Approximate center coordinates for fallback calculation
// TODO: Replace with exact verified boundary polygons once available
export const SERVICE_HUBS: ServiceHub[] = [
  {
    id: "pragathi-nagar",
    name: "Pragathi Nagar Hub",
    center: { latitude: 17.5133, longitude: 78.3970 },
    radiusKm: 10,
  },
  {
    id: "manikonda",
    name: "Mani Konda Hub",
    center: { latitude: 17.3990, longitude: 78.3840 },
    radiusKm: 10,
  },
  {
    id: "uppal",
    name: "Uppal Hub",
    center: { latitude: 17.4018, longitude: 78.5602 },
    radiusKm: 10,
  },
  {
    id: "nallagandla",
    name: "Nallagandla Hub",
    center: { latitude: 17.4695, longitude: 78.3184 },
    radiusKm: 10,
  }
];

// Specific localities (sub-areas) for accurate UI display overrides
export const SERVICE_AREAS: ServiceArea[] = [
  {
    id: "gopanpally",
    name: "Gopanpally",
    hubId: "nallagandla",
    pinCodes: ["500107"],
    center: { latitude: 17.4276, longitude: 78.3285 },
    radiusKm: 3,
  },
  // Add other areas here as precise coordinates/polygons become available.
  // The system will fallback to Reverse Geocoding string matching if an area is not explicitly defined here.
];

/**
 * Calculates the distance between two coordinates in kilometers using the Haversine formula.
 */
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}

/**
 * Ray-casting algorithm to check if a point is inside a polygon.
 */
function isPointInPolygon(point: Coordinate, polygon: Coordinate[]) {
  const x = point.longitude, y = point.latitude;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude, yi = polygon[i].latitude;
    const xj = polygon[j].longitude, yj = polygon[j].latitude;
    
    const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Validates if the GPS coordinate is inside ANY overarching Neatify Hub.
 * This determines if the user gets the "Coming Soon" screen or not.
 */
export function isServiceable(latitude: number, longitude: number): boolean {
  for (const hub of SERVICE_HUBS) {
    if (hub.polygon && hub.polygon.length > 2) {
      if (isPointInPolygon({ latitude, longitude }, hub.polygon)) {
        return true;
      }
    } else {
      const dist = getDistanceFromLatLonInKm(latitude, longitude, hub.center.latitude, hub.center.longitude);
      if (dist <= hub.radiusKm) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Returns the most accurate specific Service Area (e.g., Gopanpally) based on priority rules:
 * 1. GPS boundary match (Polygon or Radius) for a specific sub-area.
 * 2. PIN code match (if we know they are in a hub, but don't have sub-area GPS).
 * 3. Exact Name match against known areas.
 * Returns null if no specific predefined sub-area matches, meaning UI should fallback to reverse geocoded locality.
 */
export function getServiceAreaMatch(
  latitude: number, 
  longitude: number, 
  postalCode?: string | null,
  localityString?: string | null
): ServiceArea | null {
  
  // 1. Check for exact GPS match (Polygon or Radius) in our predefined sub-areas
  for (const area of SERVICE_AREAS) {
    if (area.polygon && area.polygon.length > 2) {
      if (isPointInPolygon({ latitude, longitude }, area.polygon)) {
        return area;
      }
    } else if (area.center && area.radiusKm) {
      const dist = getDistanceFromLatLonInKm(latitude, longitude, area.center.latitude, area.center.longitude);
      if (dist <= area.radiusKm) {
        return area;
      }
    }
  }

  // 2. PIN-Code validation fallback
  if (postalCode) {
    const pinMatch = SERVICE_AREAS.find(a => a.pinCodes.includes(postalCode));
    if (pinMatch) return pinMatch;
  }

  // 3. Name mapping validation fallback (e.g., reverse geocoder says "Gopanpally")
  if (localityString) {
    const nameMatch = SERVICE_AREAS.find(a => a.name.toLowerCase() === localityString.toLowerCase());
    if (nameMatch) return nameMatch;
  }

  return null;
}
