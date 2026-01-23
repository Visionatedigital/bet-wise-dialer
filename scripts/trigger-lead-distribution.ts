import * as dotenv from 'dotenv';

dotenv.config();

const projectRef = 'hahkgifqajdnhvkbzwfx';
const functionName = 'distribute-leads';
const url = `https://${projectRef}.supabase.co/functions/v1/${functionName}`;
const anonKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

console.log(`Invoking ${url}...`);

async function invokeFunction() {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const text = await response.text();

        try {
            const json = JSON.parse(text);
            console.log('Response:', JSON.stringify(json, null, 2));
        } catch {
            console.log('Response (text):', text);
        }

        if (!response.ok) {
            console.error('Failed with status:', response.status);
        } else {
            console.log('Success!');
        }

    } catch (error) {
        console.error('Error invoking function:', error);
    }
}

invokeFunction();
