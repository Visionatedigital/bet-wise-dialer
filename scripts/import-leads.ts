import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importLeadsFromExcel() {
    try {
        console.log('Starting lead import from Excel...');

        // Get first user to assign leads to
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);

        const userId = profiles?.[0]?.id;

        if (!userId) {
            console.error('❌ No user found. Please create a user first.');
            return;
        }

        console.log(`Using user ${userId} as owner for leads`);

        // Read the Excel file
        const workbook = XLSX.readFile('telemarkting0106-13(1).xlsx');
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`Found ${data.length} rows in Excel file`);

        // Map Excel data to leads format
        const leads = data.map((row: any, index: number) => ({
            user_id: userId,
            name: `Player ${row['用户id']}`,
            phone: String(row['username'] || ''),
            segment: row['用户类型'] === '小飞机游戏用户' ? 'vip' : 'dormant',
            priority: 'medium',
            score: 50,
            campaign: `Excel Import - ${new Date().toISOString().split('T')[0]}`,
            tags: [row['用户类型'] || 'unknown'],
            intent: `Country: ${row['国家'] || 'unknown'}, Deposit: ${row['近一年充值金额(美元)'] || 0} USD, Player ID: ${row['用户id']}`
        }));

        console.log(`Prepared ${leads.length} leads for import`);

        // Insert leads in batches
        const batchSize = 100;
        let imported = 0;

        for (let i = 0; i < leads.length; i += batchSize) {
            const batch = leads.slice(i, i + batchSize);

            const { data: insertedData, error } = await supabase
                .from('leads')
                .insert(batch)
                .select();

            if (error) {
                console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error);
            } else {
                imported += insertedData?.length || 0;
                console.log(`✅ Imported batch ${i / batchSize + 1}: ${insertedData?.length} leads`);
            }
        }

        console.log(`\n🎉 Successfully imported ${imported} out of ${leads.length} leads!`);

    } catch (error) {
        console.error('❌ Error importing leads:', error);
    }
}

importLeadsFromExcel();
