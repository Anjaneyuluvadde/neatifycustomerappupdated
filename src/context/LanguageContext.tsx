import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Language, translations } from "../i18n/translations";

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>("en");

    useEffect(() => {
        loadLanguage();
    }, []);

    const loadLanguage = async () => {
        try {
            // Disabled: Always use English
            setLanguageState("en");
        } catch (error) {
            console.log("Failed to load language", error);
        }
    };

    const setLanguage = async (lang: Language) => {
        // Disabled: Force English
        setLanguageState("en");
        // await AsyncStorage.setItem("app_language", lang);
    };

    const t = (key: string) => {
        const keys = key.split(".");
        // Disabled multilingual lookups: Force "en"
        let value: any = translations["en"];

        for (const k of keys) {
            if (value && typeof value === "object") {
                value = value[k];
            } else {
                return key; // Return key if not found
            }
        }

        return value || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}
