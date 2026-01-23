import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // Use ANON key

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnonAccess() {
    try {
        console.log('Using ANON KEY to fetch profiles...');
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .limit(5);

        if (error) {
            console.error('Error:', error);
        } else {
            console.log(`Success! Found ${profiles.length} profiles.`);
            console.log(profiles);
        }
    } catch (err) {
        console.log('Exception:', err);
    }
}

testAnonAccess();
