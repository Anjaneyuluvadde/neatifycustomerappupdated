export const isTempEmail = (email?: string | null): boolean => {
    if (!email) return false;
    const lower = email.toLowerCase();
    return (
        lower.includes("@neatify.app") ||
        lower.includes("@phone.neatify.app") ||
        lower.endsWith("@temp.com") ||
        lower.startsWith("temp_") ||
        lower.startsWith("emp_")
    );
};
