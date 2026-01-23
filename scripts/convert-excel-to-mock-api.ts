import XLSX from 'xlsx';
import * as fs from 'fs';

// Read the Excel file and convert to mock API format
const workbook = XLSX.readFile('telemarkting0106-13(1).xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`Found ${data.length} rows in Excel file`);

// Convert to mock API player format
const players = data.map((row: any, index: number) => ({
    player_id: `UG${String(row['用户id']).padStart(6, '0')}`,
    phone: `+${row['username']}`,
    name: `Player ${row['用户id']}`,
    vip_level: 'silver', // Default to silver
    preferred_product: row['用户类型'] === '小飞机游戏用户' ? 'aviator' : 'casino',
    language_preference: 'english',
    timezone: 'Africa/Kampala',
    account_status: 'active',
    days_inactive: 20, // Default for VIP dormant
    current_balance: 0,
    total_deposits: (row['近一年充值金额(美元)'] || 0) * 3700, // USD to UGX
    total_withdrawals: 0,
    lifetime_value: (row['近一年充值金额(美元)'] || 0) * 3700,
    currency: 'UGX',
    last_login: '2026-01-01T10:00:00Z',
    last_deposit: '2025-12-15T14:30:00Z',
    marketing_consent: true
}));

console.log(`Converted ${players.length} players`);
console.log('Sample player:', players[0]);

// Generate TypeScript code for seed-data.ts
const tsCode = `// Auto-generated from Excel file
// ${players.length} real players from telemarketing campaign

export const mockPlayers = ${JSON.stringify(players, null, 2)};
`;

// Write to a new file
fs.writeFileSync('supabase/functions/mock-bangbet-api/real-players-data.ts', tsCode);

console.log('✅ Generated real-players-data.ts with', players.length, 'players');
console.log('Now update seed-data.ts to import and use these players');
