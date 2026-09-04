import { Star } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import AnimatedGradientBorder from "./AnimatedGradientBorder";

type ReviewModalProps = {
    visible: boolean;
    onClose: () => void;
    onSubmit: (rating: number, comment: string) => Promise<void>;
    initialRating?: number;
    initialComment?: string;
    isSubmitting?: boolean;
};

export default function ReviewModal({
    visible,
    onClose,
    onSubmit,
    initialRating = 5,
    initialComment = "",
    isSubmitting = false,
}: ReviewModalProps) {
    const { t } = useLanguage();
    const { theme } = useTheme();
    const [rating, setRating] = useState(initialRating);
    const [comment, setComment] = useState(initialComment);

    useEffect(() => {
        if (visible) {
            setRating(initialRating || 5);
            setComment(initialComment || "");
        }
    }, [visible, initialRating, initialComment]);

    const handleSubmit = async () => {
        await onSubmit(rating, comment);
    };

    const renderStars = () => {
        return (
            <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => setRating(star)}
                        activeOpacity={0.7}
                    >
                        <Star
                            size={32}
                            color={star <= rating ? "#F4C430" : theme.border}
                            fill={star <= rating ? "#F4C430" : "none"}
                            style={{ marginHorizontal: 4 }}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.modalOverlay}
            >
                <AnimatedGradientBorder
                    borderRadius={20}
                    borderWidth={2}
                    animationSpeed={3}
                    style={{ width: "100%", maxWidth: 360 }}
                >
                    <View style={[styles.modalContent, { width: "100%", maxWidth: undefined, backgroundColor: theme.background }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>{t("review.title") || "Rate Experience"}</Text>
                        <Text style={[styles.modalSubtitle, { color: theme.textLight }]}>
                            {t("review.subtitle") || "How was the service provided?"}
                        </Text>

                        {renderStars()}

                        <Text style={[styles.ratingLabel, { color: theme.text }]}>
                            {rating}/5 {rating >= 4 ? "Extremely Good! 🤩" : rating >= 3 ? "Good 🙂" : "Could be better 😐"}
                        </Text>

                        <TextInput
                            style={[styles.commentInput, { backgroundColor: theme.surfaceVariant, borderColor: theme.border, color: theme.text }]}
                            placeholder={t("review.placeholder") || "Share your experience..."}
                            value={comment}
                            onChangeText={setComment}
                            multiline
                            textAlignVertical="top"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalCancelBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                                onPress={onClose}
                                disabled={isSubmitting}
                            >
                                <Text style={[styles.modalCancelText, { color: theme.textLight }]}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalSubmitBtn, { backgroundColor: theme.primary }]}
                                onPress={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color={theme.background} />
                                ) : (
                                    <Text style={[styles.modalSubmitText, { color: theme.background }]}>Submit</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </AnimatedGradientBorder>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContent: {
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 24,
        alignItems: "center",
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#1e293b",
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: "#64748b",
        marginBottom: 20,
    },
    starsContainer: {
        flexDirection: "row",
        marginBottom: 10,
    },
    ratingLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#334155",
        marginBottom: 20,
    },
    commentInput: {
        width: "100%",
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 12,
        padding: 14,
        height: 100,
        fontSize: 15,
        color: "#333",
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: "row",
        gap: 12,
        width: "100%",
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    modalCancelBtn: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    modalSubmitBtn: {
        backgroundColor: "#EF4444", // Primary Red
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#64748b",
    },
    modalSubmitText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#fff",
    },
});
