// /**
//  * Razorpay Payment Service
//  * Handles order creation and payment processing
//  */

// import RazorpayCheckout from "react-native-razorpay";

// const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "";
// const ORDER_SERVER_URL = process.env.EXPO_PUBLIC_ORDER_SERVER_URL || "";

// /* ================= TYPES ================= */

// export type CustomerDetails = {
//   firstName: string;
//   lastName: string;
//   email: string;
//   phone: string;
//   address: string;
//   city: string;
//   region: string;
//   zip: string;
// };

// export type RazorpayOrder = {
//   id: string;
//   amount: number;
//   currency: string;
// };

// export type PaymentResult = {
//   success: boolean;
//   paymentId?: string;
//   orderId?: string;
//   signature?: string;
//   error?: string;
// };

// /* ================= CREATE ORDER ================= */

// /**
//  * Create a Razorpay order on the backend server
//  * @param amount - Amount in INR (will be converted to paise)
//  * @returns Order object with id, amount, currency
//  */
// export async function createOrder(amount: number): Promise<RazorpayOrder> {
//   const url = `${ORDER_SERVER_URL}/create-razorpay-order`;

//   console.log("=== RAZORPAY DEBUG ===");
//   console.log("Server URL:", ORDER_SERVER_URL);
//   console.log("Razorpay Key:", RAZORPAY_KEY_ID ? "Set (hidden)" : "NOT SET!");
//   console.log("Amount (paise):", amount * 100);

//   try {
//     const response = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         amount: amount * 100, // Convert to paise
//         currency: "INR",
//       }),
//     });

//     console.log("Response status:", response.status);

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error("Server error response:", errorText);
//       throw new Error(`Server error: ${response.status} - ${errorText}`);
//     }

//     const data = await response.json();
//     console.log("Order created:", data);

//     if (!data.id) {
//       throw new Error("No order ID in response: " + JSON.stringify(data));
//     }

//     return {
//       id: data.id,
//       amount: data.amount,
//       currency: data.currency || "INR",
//     };
//   } catch (error: any) {
//     console.error("Error creating order:", error);
//     throw new Error(error?.message || "Failed to create order. Please try again.");
//   }
// }

// /* ================= OPEN RAZORPAY CHECKOUT ================= */

// /**
//  * Open Razorpay checkout modal
//  * @param order - Razorpay order object
//  * @param customer - Customer details
//  * @returns Payment result with success status and payment details
//  */
// export async function openRazorpayCheckout(
//   order: RazorpayOrder,
//   customer: CustomerDetails,
// ): Promise<PaymentResult> {
//   const options = {
//     description: "Neatify Nation Service Booking",
//     image: "https://zwidqujljmgdrlpafino.supabase.co/storage/v1/object/public/razorpay/favicon12.png",
//     currency: order.currency,
//     key: RAZORPAY_KEY_ID,
//     amount: order.amount,
//     name: "The Neatify Nation",
//     order_id: order.id,
//     prefill: {
//       email: customer.email,
//       contact: customer.phone,
//       name: `${customer.firstName} ${customer.lastName}`,
//     },
//     theme: { color: "#000000" },
//   };

//   try {
//     const data = await RazorpayCheckout.open(options);
//     return {
//       success: true,
//       paymentId: data.razorpay_payment_id,
//       orderId: data.razorpay_order_id,
//       signature: data.razorpay_signature,
//     };
//   } catch (error: any) {
//     console.error("Razorpay error:", error);
//     return {
//       success: false,
//       error: error?.description || error?.message || "Payment cancelled",
//     };
//   }
// }

// /* ================= PROCESS PAYMENT ================= */

// /**
//  * Complete payment flow: create order and open checkout
//  * @param amount - Amount in INR
//  * @param customer - Customer details
//  * @returns Payment result
//  */
// export async function processPayment(
//   amount: number,
//   customer: CustomerDetails,
// ): Promise<PaymentResult> {
//   try {
//     // Step 1: Create order on server
//     const order = await createOrder(amount);

//     // Step 2: Open Razorpay checkout
//     const result = await openRazorpayCheckout(order, customer);

//     return result;
//   } catch (error: any) {
//     return {
//       success: false,
//       error: error?.message || "Payment failed",
//     };
//   }
// }
/**
 * Razorpay Payment Service
 * Supabase Edge Function Version
 */

import RazorpayCheckout from "react-native-razorpay";
import { invokeFunction } from "./backendClient"; // ✅ Use existing supabase client

const RAZORPAY_KEY_ID = (
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
  process.env.REACT_APP_RAZORPAY_KEY ||
  process.env.EXPO_PUBLIC_RAZORPAY_KEY ||
  ""
).trim();

/* ================= TYPES ================= */

export type CustomerDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  zip: string;
};

export type PaymentResult = {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  signature?: string;
  error?: string;
};

/* ================= PROCESS PAYMENT ================= */

export async function processPayment(
  amount: number,
  customer: CustomerDetails,
  bookingId: string,
): Promise<PaymentResult> {
  try {
    /* ================= 1️⃣ CREATE ORDER ================= */

    console.log("🔵 Starting payment process...");
    console.log("🔵 Booking ID:", bookingId);
    console.log("🔵 Amount (INR):", amount);

    // ✅ Use invokeFunction instead of manual fetch
    const { data: orderData, error: orderError } = await invokeFunction("create-razorpay-order", {
      body: {
        booking_id: bookingId,
        amount: amount, // INR (Edge Function handles conversion to paise)
      },
    });

    if (orderError) {
      console.error("❌ Order creation failed:", orderError);
      throw new Error(orderError.message || "Failed to create order");
    }

    console.log("🔵 Order Data:", JSON.stringify(orderData, null, 2));

    // Support both 'order_id' and 'id' as per Razorpay response formats
    const finalOrderId = orderData?.order_id || orderData?.id;

    if (!finalOrderId) {
      throw new Error(orderData?.error || "Failed to create order");
    }

    console.log("✅ Order created successfully:", finalOrderId);

    /* ================= 2️⃣ OPEN RAZORPAY ================= */

    const razorpayOptions = {
      description: "Neatify Service (OPC) Private Limited",
      currency: orderData.currency || "INR",
      key: orderData.key || RAZORPAY_KEY_ID,
      amount: orderData.amount,
      name: "The Neatify Team",
      order_id: finalOrderId,
      prefill: {
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        contact: customer.phone,
      },
      notes: {
        booking_id: bookingId,
      },
      theme: { color: "#000000" },
    };

    console.log("🔵 Opening Razorpay with options:", {
      ...razorpayOptions,
      key: "HIDDEN",
    });

    const payment = await RazorpayCheckout.open(razorpayOptions);
    console.log("✅ Payment completed:", payment);

    /* ================= 3️⃣ VERIFY PAYMENT ================= */

    const { data: verifyData, error: verifyError } = await invokeFunction("verify-payment", {
      body: {
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature,
        booking_id: bookingId,
      },
    });

    if (verifyError || !verifyData?.success) {
      throw new Error("Payment verification failed");
    }

    /* ================= SUCCESS ================= */

    console.log("✅✅✅ Payment successful!");
    return {
      success: true,
      paymentId: payment.razorpay_payment_id,
      orderId: payment.razorpay_order_id,
      signature: payment.razorpay_signature,
    };

  } catch (error: any) {
    console.error("❌ Payment error:", error);
    console.error("❌ Error message:", error?.message);
    console.error("❌ Error code:", error?.code);
    console.error("❌ Error description:", error?.description);
    return {
      success: false,
      error: error?.description || error?.message || "Payment failed",
    };
  }
}

