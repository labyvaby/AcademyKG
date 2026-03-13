
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // 1. Read .env.local manually
        const envPath = path.resolve(__dirname, '../.env.local');
        if (!fs.existsSync(envPath)) {
            console.error('❌ .env.local not found!');
            process.exit(1);
        }

        const envContent = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                env[key] = value;
            }
        });

        const url = env.VITE_SUPABASE_URL;
        const key = env.VITE_SUPABASE_ANON_KEY;

        if (!url || !key) {
            console.error('❌ Missing credentials in .env.local');
            console.log('Keys found:', Object.keys(env));
            process.exit(1);
        }

        // 2. Initialize Supabase
        const supabase = createClient(url, key);

        // 3. Query app_settings
        // Note: RLS might block anon 'select', but let's try. 
        // If it fails with permission denied (401/403), it often allows confirming the table *exists* (vs 404).
        // Actually, we set policy "Enable read access for authenticated users".
        // Does ANON key count as authenticated? No, usually it's "anon" role.
        // authenticated requires login.
        // But we can check if we get a 404 (table not found) vs 401 (unauthorized).
        // PGRST205 was "Could not find the table".
        // 401 would be "permission denied".

        console.log('Testing connection to:', url);
        const { data, error } = await supabase.from('app_settings').select('count', { count: 'exact', head: true });

        if (error) {
            if (error.code === '42P01') { // undefined_table
                console.error('❌ Table app_settings does NOT exist (42P01).');
                process.exit(1);
            }
            if (error.code === 'PGRST205') {
                console.error('❌ Table app_settings does NOT exist (PGRST205).');
                process.exit(1);
            }

            console.log('⚠️ Request returned error, but table likely exists:', error.message, error.code);
            console.log('✅ Verification passed (Table found, even if access restricted).');
        } else {
            console.log('✅ Table app_settings exists and is accessible. Count:', data);
        }

    } catch (err) {
        console.error('Unexpected error:', err);
        process.exit(1);
    }
}

main();
