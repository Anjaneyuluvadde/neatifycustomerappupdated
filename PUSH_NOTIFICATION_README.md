# Neatify Push Notification Documentation

This document provides a complete overview and implementation guide for the Push Notification system integrated into the Neatify React Native application using Expo and Supabase.

---

## 1. Architecture Flow
The system follows a 3-stage process to deliver notifications from the backend to the user's physical device.

### Stage 1: Device Registration
- **Permission**: The app requests notification permissions upon user login.
- **Token**: If granted, an **Expo Push Token** is generated (unique to the device and project).
- **Database**: This token is stored in the Supabase `push_tokens` table, mapped to the `user_id`.

### Stage 2: Triggering
- **Database Event**: A change occurs in Supabase (e.g., a booking status changes or a new offer is added).
- **Webhook**: Supabase triggers the `send-notification` Edge Function.
- **Logic**: The Edge Function determines the message content and retrieves the target user's token from the `push_tokens` table.

### Stage 3: Delivery
- **Handshake**: The Edge Function sends the message and token to **Expo's Push Service**.
- **FCM (Firebase)**: Expo uses the uploaded **FCM Service Account Key** to deliver the message via Google's Firebase Cloud Messaging.
- **Reception**: The device receives the notification. Tapping it triggers deep-linking navigation within the app.

---

## 2. Implementation Steps

### A. Firebase Setup
1. Created a Firebase project.
2. Added an Android app and registered it with your package name (`com.neatifyteam.app`).
3. Generated a **Service Account JSON (FCM V1)** from Project Settings.

### B. App Configuration (`app.json`)
- Linked the `google-services.json` file path.
- Added the `expo-notifications` plugin.
- Configured the EAS `projectId`.

### C. Frontend Code
- **`src/utils/pushNotifications.ts`**: Handles permission requests, token retrieval, and Supabase upsert logic.
- **`src/context/NotificationContext.tsx`**: Manages foreground notification listeners and in-app toast alerts.
- **`App.tsx`**: Integrates registration logic and handles navigation when a notification is tapped.

### D. Supabase Setup
- **Table**: `public.push_tokens` (Schema: `id`, `user_id`, `token`, `platform`).
- **Edge Function**: `send-notification` handles the logic for different tables (`bookings`, `offers`, `app_popups`).
- **Webhooks**: Enabled database triggers to call the Edge Function on `INSERT` and `UPDATE`.

### E. Expo Credentials
- Uploaded the **FCM V1 Service Account Key** to Expo via `eas credentials` or the Expo Dashboard.

---

## 3. Notification Triggers (Edge Function Logic)

| Trigger | Condition | Notification Message |
| :--- | :--- | :--- |
| **Staff Assigned** | `assigned_staff_email` is added | "Staff Assigned! 🛠️ - A professional has been assigned..." |
| **Booking Confirmed** | `payment_verified` becomes `true` | "Booking Confirmed! 🎉 - Your payment has been verified..." |
| **Staff on the way** | `work_status` becomes `assigned` | "Staff on the way! 🛵 - Your assigned professional is..." |
| **Service Completed** | `work_status` becomes `completed` | "Service Completed! ✅ - Your service has been completed..." |
| **Booking Cancelled** | `work_status` becomes `cancelled` | "Booking Cancelled ❌ - Your booking has been cancelled..." |
| **Refund Successful** | `refund_status` becomes `refunded` | "Refund Successful 💰 - Your refund has been processed." |
| **Offers/Popups** | New row in `offers`/`app_popups` | Uses the `title` and `description` from the table. |

---

## 4. How to Test

### Using Supabase Dashboard (Manual Test)
1. Go to **Edge Functions** > **send-notification** > **Test**.
2. Use the following JSON format:
```json
{
  "table": "offers",
  "record": {
    "title": "Test Title",
    "description": "Test Description",
    "id": "123"
  }
}
```

### Real-world Test
1. Log in to the app on a **physical device**.
2. Ensure your token appears in the `push_tokens` table in Supabase.
3. Manually change a `work_status` in the `bookings` table to `completed`.
4. The notification should arrive on the device within seconds.

---

## 5. Troubleshooting Common Issues

| Issue | Potential Cause | Solution |
| :--- | :--- | :--- |
| **Token not saving** | RLS Policies in Supabase | Ensure the `push_tokens` table allows `INSERT/UPSERT`. |
| **400 Missing Data** | Wrong Test JSON | Ensure test JSON has `"table"` and `"record"` keys. |
| **200 OK but no alert** | Missing Channel ID | Android requires `channelId: "default"` in the Edge Function. |
| **Invalid Credentials** | Missing FCM Key | Upload the Firebase Service Account JSON to Expo Dashboard. |
| **Not appearing (Android)** | App Settings | Enable "All Notifications" and the "default" category in Phone Settings. |
