import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNotification } from "./useNotification";

export function useAuthGuard() {
    const { showAlert } = useNotification();
    const navigation = useNavigation<any>();
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const checkAuth = async (action: string = "continue"): Promise<boolean> => {
        try {
            const { data } = await supabase.auth.getSession();

            if (!data.session) {
                showAlert({
                    type: "info",
                    title: "Login Required",
                    message: `Please login or sign up to ${action}`,
                    showCancel: true,
                    confirmText: "Login / Sign Up",
                    onConfirm: () => {
                        // Traverse to root and navigate to Login
                        const parent = navigation.getParent("root-drawer") || navigation;
                        parent.navigate("Login");
                    }
                });
                return false;
            }

            setIsAuthenticated(true);
            return true;
        } catch (error) {
            console.error("Auth check error:", error);
            return false;
        }
    };

    return { checkAuth, isAuthenticated };
}
