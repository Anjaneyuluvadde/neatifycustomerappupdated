import React, { createContext, ReactNode, useState, useEffect, useRef } from "react";
import * as Notifications from 'expo-notifications';
import { supabase } from "../lib/supabase";
import { registerForPushNotificationsAsync, savePushTokenToSupabase } from "../utils/pushNotifications";
import AppToast from "../components/AppToast";
import CustomAlert from "../components/CustomAlert";

type AlertType = "success" | "error" | "warning" | "info";

interface AlertConfig {
    type: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm?: () => void;
    cancelText?: string;
    showCancel?: boolean;
}

interface ToastConfig {
    message: string;
    type: "success" | "error" | "info";
}

interface NotificationContextType {
    showAlert: (config: AlertConfig) => void;
    showToast: (message: string, type?: "success" | "error" | "info") => void;
    hideAlert: () => void;
}

export const NotificationContext = createContext<NotificationContextType>({
    showAlert: () => { },
    showToast: () => { },
    hideAlert: () => { },
});

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
    const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [showToastModal, setShowToastModal] = useState(false);

    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    useEffect(() => {
        // ✅ THE MISSING LINK: Register tokens automatically
        const setupNotifications = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const token = await registerForPushNotificationsAsync();
                if (token) {
                    await savePushTokenToSupabase(session.user.id, token);
                }
            }
        };

        setupNotifications();

        // Listen for auth changes to register new tokens on login
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const token = await registerForPushNotificationsAsync();
                if (token) {
                    await savePushTokenToSupabase(session.user.id, token);
                }
            }
        });

        // Set up the custom channel for Android
        Notifications.setNotificationChannelAsync('custom-sound-channel-v3', {
            name: 'Custom Sound Alerts',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'my_custom_sound.wav', // Put the exact file name here (with extension)
        });

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log('Notification Received:', notification);
            // In-app feedback for foreground notifications
            const { title, body } = notification.request.content;
            showToast(`${title}: ${body}`, "info");
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('Notification Tapped:', response);
            // Deep linking is handled by Expo Router/Linking if configured, 
            // but we can add custom logic here if needed.
        });

        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
            authListener.subscription.unsubscribe();
        };
    }, []);

    const showAlert = (config: AlertConfig) => {
        setAlertConfig(config);
        setShowAlertModal(true);
    };

    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        setToastConfig({ message, type });
        setShowToastModal(true);
    };

    const hideAlert = () => {
        setShowAlertModal(false);
        setTimeout(() => setAlertConfig(null), 300);
    };

    const handleAlertConfirm = () => {
        if (alertConfig?.onConfirm) {
            alertConfig.onConfirm();
        }
        hideAlert();
    };

    return (
        <NotificationContext.Provider value={{ showAlert, showToast, hideAlert }}>
            {children}

            {/* Custom Alert Modal */}
            {alertConfig && (
                <CustomAlert
                    visible={showAlertModal}
                    type={alertConfig.type}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    onClose={hideAlert}
                    confirmText={alertConfig.confirmText}
                    onConfirm={handleAlertConfirm}
                    cancelText={alertConfig.cancelText}
                    showCancel={alertConfig.showCancel}
                />
            )}

            {/* Toast Notification */}
            {toastConfig && (
                <AppToast
                    visible={showToastModal}
                    message={toastConfig.message}
                    type={toastConfig.type}
                    onHide={() => setShowToastModal(false)}
                />
            )}
        </NotificationContext.Provider>
    );
}
