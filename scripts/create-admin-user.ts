
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'bangbet',
    user: process.env.DB_USER || 'bangbet',
    password: process.env.DB_PASSWORD || 'BangBet_DB_2026!',
};

const pool = new Pool(config);

async function createAdmin() {
    const email = 'admin@bangbet.test';
    const password = 'AdminPassword2026!';
    const fullName = 'Test Admin User';

    console.log(`\n=== Creating Admin User: ${email} ===\n`);

    try {
        const hash = await bcrypt.hash(password, 10);
        
        // 1. Create User
        interface UserRow { id: string }
        const userResult = await pool.query<UserRow>(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = $2 RETURNING id',
            [email, hash]
        );
        const userId = userResult.rows[0].id;
        console.log(`✅ User entry created/updated (ID: ${userId})`);

        // 2. Create Profile
        await pool.query(
            'INSERT INTO profiles (id, email, full_name, approved) VALUES ($1, $2, $3, TRUE) ON CONFLICT (id) DO UPDATE SET approved = TRUE, full_name = $3',
            [userId, email, fullName]
        );
        console.log(`✅ Profile created/updated (Approved: TRUE)`);

        // 3. Assign Role
        await pool.query(
            'INSERT INTO user_roles (user_id, role) VALUES ($1, \'admin\') ON CONFLICT (user_id, role) DO NOTHING',
            [userId]
        );
        console.log(`✅ Admin role assigned`);

        console.log(`\n🎉 Admin account ready!`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}\n`);

    } catch (err) {
        console.error('❌ Error creating admin user:', err);
    } finally {
        await pool.end();
    }
}

createAdmin();
