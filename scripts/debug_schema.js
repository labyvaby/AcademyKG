
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing credentials in .env");
    process.exit(1);
}

const supabase = createClient(url, key);

async function inspect() {
    console.log("Fetching one row from Appointments...");
    const { data, error } = await supabase.from("Appointments").select("*").limit(1);
    if (error) {
        console.error("Error:", error);
        return;
    }
    if (!data || data.length === 0) {
        console.log("No rows found. Attempting to insert dummy to verify schema? No, risky.");
        console.log("Empty table.");
        return;
    }

    console.log("Columns found:", Object.keys(data[0]));
}

inspect();
