import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function testMockAPIAndImport() {
    try {
        console.log('=== Testing Mock BangBet API ===\n');

        // Step 1: Test mock API
        console.log('Step 1: Fetching from mock API...');
        const mockApiUrl = 'https://hahkgifqajdnhvkbzwfx.supabase.co/functions/v1/mock-bangbet-api/api/telemarketing/segments/vip-dormant';

        const response = await fetch(mockApiUrl, {
            headers: {
                'Authorization': 'Bearer test_key',
                'Content-Type': 'application/json'
            }
        });

        console.log('Mock API status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Mock API error:', errorText);
            return;
        }

        const data = await response.json();
        console.log('✅ Mock API works!');
        console.log(`   Total players available: ${data.players?.length || 0}`);

        if (data.players && data.players.length > 0) {
            console.log('   Sample player:', {
                player_id: data.players[0].player_id,
                name: data.players[0].name,
                phone: data.players[0].phone,
                vip_level: data.players[0].vip_level,
                preferred_product: data.players[0].preferred_product
            });
        }

        // Step 2: Get user for leads
        console.log('\nStep 2: Getting user ID...');
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: userRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin')
            .limit(1);

        let userId = userRoles?.[0]?.user_id;

        if (!userId) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id')
                .limit(1);
            userId = profiles?.[0]?.id;
        }

        if (!userId) {
            console.error('❌ No user found');
            return;
        }

        console.log('✅ Found user:', userId);

        // Step 3: Import a few test leads
        console.log('\nStep 3: Importing 10 test leads...');
        const playersToImport = data.players.slice(0, 10);

        const leads = playersToImport.map((p: any) => ({
            user_id: userId,
            name: p.name || `Player ${p.player_id}`,
            phone: p.phone,
            segment: 'vip',
            priority: 'medium',
            score: 50,
            campaign: `API Test - ${new Date().toISOString().split('T')[0]}`,
            tags: ['api_test', 'vip_dormant'],
            intent: `VIP: ${p.vip_level}, Product: ${p.preferred_product}, ID: ${p.player_id}`
        }));

        const { data: inserted, error } = await supabase
            .from('leads')
            .insert(leads)
            .select();

        if (error) {
            console.error('❌ Insert error:', error);
            return;
        }

        console.log(`✅ Successfully imported ${inserted.length} leads!`);
        console.log('\n=== Test Complete ===');
        console.log(`Mock API: ✅ Working (${data.players.length} players available)`);
        console.log(`Database: ✅ Working (${inserted.length} leads imported)`);
        console.log('\nYou can now:');
        console.log('1. Go to Admin Dashboard');
        console.log('2. Click "Distribute Leads to Agents"');
        console.log('3. Leads will be assigned to agents');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testMockAPIAndImport();
