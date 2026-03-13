
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(url, key);

async function checkSchema() {
    console.log("Checking 'expenses' table...");
    const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .limit(1);

    if (expensesError) {
        console.error("Error fetching expenses:", expensesError);
    } else {
        console.log("Expenses data sample:", expensesData);
        if (expensesData.length > 0) {
            console.log("Columns:", Object.keys(expensesData[0]));
        } else {
            console.log("No data in expenses table, cannot infer columns from data.");
            // Try to insert a dummy record to see errors? No, too risky.
        }
    }

    console.log("\nChecking 'expense_category' table...");
    const { data: catData, error: catError } = await supabase
        .from('expense_category')
        .select('*')
        .limit(1);

    if (catError) {
        console.error("Error fetching expense_category:", catError);
    } else {
        console.log("Category data sample:", catData);
        if (catData.length > 0) {
            console.log("Columns:", Object.keys(catData[0]));
        }
    }
}

checkSchema();
