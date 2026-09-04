
import { supabase } from "../src/lib/supabase";

async function testConnection() {
    console.log("Testing Supabase connection...");
    try {
        const { data, error } = await supabase.from("services").select("*");
        if (error) {
            console.error("Supabase Error:", error);
        } else {
            console.log(`Successfully fetched ${data?.length} services.`);
            if (data && data.length > 0) {
                console.log("Sample service:", data[0]);
            }
        }
    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

testConnection();
