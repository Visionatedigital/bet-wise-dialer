import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import fs from 'fs';
import path from 'path';
import { query } from '../db';
import { Pool } from 'pg';

async function seedAvatars() {
  const imagesPath = path.join(__dirname, 'avatars', 'small_avatars');
  const files = ['dog.png', 'cat.png', 'lion.png', 'fox.png', 'panda.png', 'tiger.png'];

  console.log('Loading avatars...');
  const avatars = files.map(file => {
    const fullPath = path.join(imagesPath, file);
    const data = fs.readFileSync(fullPath);
    const base64 = data.toString('base64');
    return `data:image/jpeg;base64,${base64}`; // sips saved it as jpeg even with .png extension
  });

  console.log('Fetching profiles with null avatars...');
  const result = await query('SELECT id FROM profiles WHERE avatar_url IS NULL');
  const profiles = result.rows;
  
  if (profiles.length === 0) {
    console.log('All profiles already have an avatar.');
    process.exit(0);
  }

  console.log(`Found ${profiles.length} profiles to update. Adding random avatars...`);

  for (const p of profiles) {
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    await query('UPDATE profiles SET avatar_url = $1 WHERE id = $2', [randomAvatar, p.id]);
  }

  console.log('Default animal avatars assigned successfully!');
  process.exit(0);
}

seedAvatars().catch(err => {
  console.error(err);
  process.exit(1);
});
