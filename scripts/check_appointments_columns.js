
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkColumns() {
    const { data, error } = await supabase.from('Appointments').select('*').limit(1);
    if (error) {
        console.error("Error:", error);
    } else if (data && data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
    } else {
        console.log("Empty table, trying another way...");
        // Just try to get column names if empty
        const { data: cols, error: err } = await supabase.rpc('execute_sql', {
            sql_query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'Appointments'"
        });
        if (err) console.error("Error getting columns:", err);
        else console.log("Columns:", cols.map(c => c.column_name));
    }
}

checkColumns();
