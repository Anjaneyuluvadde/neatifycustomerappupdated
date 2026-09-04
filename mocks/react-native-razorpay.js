/**
 * Mock shim for react-native-razorpay
 * Used when running in Expo Go (which cannot load native modules).
 * The real module is used in production APK/IPA builds via expo-dev-client.
 */
const RazorpayCheckout = {
  open: (options) => {
    return Promise.reject({
      code: 0,
      description: "Razorpay is not available in Expo Go. Please use a development build (APK).",
    });
  },
};

export default RazorpayCheckout;
