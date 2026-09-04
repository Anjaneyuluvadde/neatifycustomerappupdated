import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBookingCart } from "../context/BookingCartContext";

/**
 * Calculates the exact bottom padding required for scrollable content
 * to scroll completely above the absolute-positioned custom bottom navigation bar.
 * 
 * Includes the bar height (70), bar bottom padding (15), safe area, and extra spacing.
 */
export function useBottomNavPadding(extraPadding: number = 24, ignoreCart: boolean = false) {
    const insets = useSafeAreaInsets();
    const { cartItems } = useBookingCart();
    
    // CustomTabBar height (70) + tab bar bottom padding (15)
    const BOTTOM_NAV_HEIGHT = 85; 
    
    // If the cart is visible, leave room for FloatingCartSummary
    const cartHeight = (!ignoreCart && cartItems.length > 0) ? 140 : 0;
    
    return {
        paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + extraPadding + cartHeight,
    };
}
