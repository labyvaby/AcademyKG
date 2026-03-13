
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function getFunctionDefinition() {
    const { data, error } = await supabase.rpc('execute_sql', {
        sql_query: `
      SELECT prosrc 
      FROM pg_proc 
      JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace 
      WHERE proname = 'create_full_appointment' 
      AND nspname = 'public';
    `
    });

    if (error) {
        console.error("Error fetching function:", error);
    } else {
        console.log("Function Source:\n", data?.[0]?.prosrc);
    }
}

getFunctionDefinition();
