import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { getServiceAreaMatch, isServiceable } from "../config/serviceAreas";
import { supabase } from "../lib/supabase";

const SELECTED_LOCATION_KEY = "neatify_selected_location";

export interface LocationResult {
  locality: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  postalCode: string | null;
  rawAddress: Location.LocationGeocodedAddress | null;
  isServiceable: boolean;
  status: 'success' | 'permission_denied' | 'error' | 'unserviceable' | 'services_disabled';
}

class LocationService {
  /**
   * Helper to parse the most specific locality string from Expo's address object.
   * Matches Android/iOS specific fields accurately.
   */
  public static getLocalityString(addr: Location.LocationGeocodedAddress): string {
    // Priority: subLocality (e.g. Gopanpally) -> neighborhood -> street -> name -> district (e.g. Tellapur) -> city
    const anyAddr = addr as any;
    if (anyAddr.subLocality && anyAddr.subLocality.length > 0) return anyAddr.subLocality;
    if (anyAddr.neighborhood && anyAddr.neighborhood.length > 0) return anyAddr.neighborhood;
    if (addr.name && addr.name.length > 0) return addr.name;
    if (addr.street && addr.street.length > 0) return addr.street;
    if (addr.district && addr.district.length > 0) return addr.district;
    if (addr.city && addr.city.length > 0) return addr.city;
    if (addr.subregion && addr.subregion.length > 0) return addr.subregion;
    if (addr.region && addr.region.length > 0) return addr.region;

    return "Unknown Location";
  }

  public static async setSelectedLocation(location: LocationResult | null) {
    if (location) {
      await AsyncStorage.setItem(SELECTED_LOCATION_KEY, JSON.stringify(location));
    } else {
      await AsyncStorage.removeItem(SELECTED_LOCATION_KEY);
    }
  }

  public static async getSelectedLocation(): Promise<LocationResult | null> {
    try {
      const data = await AsyncStorage.getItem(SELECTED_LOCATION_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error("Error reading selected location:", e);
    }
    return null;
  }

  /**
   * Fetches current GPS location, reverse geocodes, and returns a unified result.
   * If forceGPS is false, it returns the user's manually selected location if available.
   */
  public static async fetchCurrentLocation(accuracy: Location.LocationAccuracy = Location.Accuracy.Balanced, forceGPS: boolean = false): Promise<LocationResult> {
    try {
      if (!forceGPS) {
        const manualLocation = await this.getSelectedLocation();
        if (manualLocation) {
          return manualLocation;
        }
      }

      // 0. Check if services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        return {
          locality: "Location services disabled",
          fullAddress: "",
          latitude: 0,
          longitude: 0,
          postalCode: null,
          rawAddress: null,
          isServiceable: false,
          status: 'services_disabled',
        };
      }

      // 1. Permission Handling
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status: reqStatus } = await Location.requestForegroundPermissionsAsync();
        finalStatus = reqStatus;
      }

      if (finalStatus !== 'granted') {
        return {
          locality: "Permission denied",
          fullAddress: "",
          latitude: 0,
          longitude: 0,
          postalCode: null,
          rawAddress: null,
          isServiceable: false,
          status: 'permission_denied',
        };
      }

      // 2. Get GPS coordinates
      const location = await Location.getCurrentPositionAsync({
        accuracy: accuracy,
      });

      const { latitude, longitude } = location.coords;

      // 3. Serviceability Check (can be bypassed for specific needs, but usually checked)
      const serviceable = isServiceable(latitude, longitude);

      // 4. Reverse Geocoding
      const addressList = await Location.reverseGeocodeAsync({ latitude, longitude });

      let reverseString = "Unknown Location";
      let postalCode = null;
      let rawAddress = null;
      let fullAddress = "";

      if (addressList && addressList.length > 0) {
        rawAddress = addressList[0];
        postalCode = rawAddress.postalCode || null;
        reverseString = this.getLocalityString(rawAddress);

        // Try to get the formatted address directly, or build it
        const anyAddr = rawAddress as any;
        if (anyAddr.formattedAddress) {
          fullAddress = anyAddr.formattedAddress;
        } else {
          // Fallback construction
          const parts = [
            rawAddress.street,
            (rawAddress as any).subLocality,
            rawAddress.city || rawAddress.district,
            rawAddress.region,
            rawAddress.postalCode,
          ].filter(Boolean);
          fullAddress = parts.join(", ");
        }
      }

      // 5. Match with Neatify Specific Sub-Areas (e.g. strict Gopanpally polygon)
      const matchedArea = getServiceAreaMatch(latitude, longitude, postalCode, reverseString);

      let finalLocality = matchedArea ? matchedArea.name : reverseString;
      let finalServiceable = serviceable;
      let serviceStatus: 'success' | 'permission_denied' | 'error' | 'unserviceable' | 'services_disabled' = 'success';

      if (postalCode) {
        try {
          const { data, error } = await supabase
            .from("hub_locations")
            .select("hub_name, is_active")
            .eq("pincode", postalCode)
            .eq("is_active", true)
            .limit(1);

          if (error) {
            console.warn("Supabase error fetching service areas:", error.message);
            finalServiceable = false;
            serviceStatus = 'error';
          } else if (data && data.length > 0) {
            finalLocality = data[0].hub_name || finalLocality;
            finalServiceable = true;
            serviceStatus = 'success';
          } else {
            finalServiceable = false;
            serviceStatus = 'unserviceable';
          }
        } catch (e) {
          console.warn("Network error fetching service areas:", e);
          finalServiceable = false;
          serviceStatus = 'error';
        }
      } else {
        serviceStatus = 'unserviceable';
        finalServiceable = false;
      }

      return {
        locality: finalLocality,
        fullAddress: fullAddress || reverseString,
        latitude,
        longitude,
        postalCode,
        rawAddress,
        isServiceable: finalServiceable,
        status: serviceStatus,
      };

    } catch (error) {
      console.error("LocationService error:", error);
      return {
        locality: "Unable to update location",
        fullAddress: "",
        latitude: 0,
        longitude: 0,
        postalCode: null,
        rawAddress: null,
        isServiceable: false,
        status: 'error',
      };
    }
  }
}

export default LocationService;
