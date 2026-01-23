import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

async function importAllLeadsFromMockAPI() {
    try {
        console.log('=== Importing ALL 1022 Leads from Mock API ===\n');

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Step 1: Fetch ALL players from mock API
        console.log('Step 1: Fetching all players from mock API...');
        const mockApiUrl = `${supabaseUrl}/functions/v1/mock-bangbet-api/api/telemarketing/segments/vip-dormant`;

        const response = await fetch(mockApiUrl, {
            headers: {
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'apikey': supabaseAnonKey,
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Mock API error:', errorText);
            return;
        }

        const data = await response.json();
        const allPlayers = data.players || [];

        console.log(`✅ Fetched ${allPlayers.length} players from mock API`);

        if (allPlayers.length === 0) {
            console.error('❌ No players found in mock API');
            return;
        }

        // Step 2: Get admin user
        console.log('\nStep 2: Getting admin user...');
        const { data: userRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin')
            .limit(1);

        const userId = userRoles?.[0]?.user_id;

        if (!userId) {
            console.error('❌ No admin user found');
            return;
        }

        console.log(`✅ Using admin user: ${userId}`);

        // Step 3: Convert to leads format
        console.log('\nStep 3: Converting players to leads...');
        const leads = allPlayers.map((p: any) => ({
            user_id: userId,
            name: p.name || `Player ${p.player_id}`,
            phone: p.phone,
            segment: 'vip',
            priority: 'medium',
            score: 50,
            campaign: `VIP Dormant - ${new Date().toISOString().split('T')[0]}`,
            tags: ['vip_dormant', p.preferred_product || 'unknown'],
            intent: `VIP: ${p.vip_level}, Product: ${p.preferred_product}, ID: ${p.player_id}`
        }));

        console.log(`✅ Prepared ${leads.length} leads`);

        // Step 4: Import in batches
        console.log('\nStep 4: Importing leads in batches...');
        const batchSize = 100;
        let imported = 0;

        for (let i = 0; i < leads.length; i += batchSize) {
            const batch = leads.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(leads.length / batchSize);

            const { data: inserted, error } = await supabase
                .from('leads')
                .insert(batch)
                .select();

            if (error) {
                console.error(`❌ Batch ${batchNum}/${totalBatches} failed:`, error.message);
            } else {
                imported += inserted?.length || 0;
                console.log(`✅ Batch ${batchNum}/${totalBatches}: Imported ${inserted?.length} leads (Total: ${imported}/${leads.length})`);
            }
        }

        console.log(`\n🎉 Import Complete!`);
        console.log(`   Total leads imported: ${imported}/${leads.length}`);
        console.log(`\nNext steps:`);
        console.log(`1. Go to Admin Dashboard`);
        console.log(`2. Click "Distribute Leads to Agents"`);
        console.log(`3. Leads will be assigned to agents using round-robin`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

importAllLeadsFromMockAPI();
