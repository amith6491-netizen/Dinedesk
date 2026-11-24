import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let ATLAS_URI = 'mongodb+srv://dinedesk-admin:7899472591@cluster0.0vcsdkb.mongodb.net/dinedesk?retryWrites=true&w=majority';

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('Usage: node scripts/reset-password.mjs <email> <newPassword>');
  console.log('Example: node scripts/reset-password.mjs user@example.com 12345678');
  process.exit(1);
}

async function run() {
  console.log('🔄 Connecting to MongoDB Atlas...');
  const conn = await mongoose.createConnection(ATLAS_URI).asPromise();
  console.log('✅ Connected to Atlas!');

  const user = await conn.collection('users').findOne({
    email: { $regex: new RegExp(`^${email.trim()}$`, 'i') }
  });

  if (!user) {
    console.log(`❌ User with email "${email}" not found.`);
    await conn.close();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await conn.collection('users').updateOne(
    { _id: user._id },
    { 
      $set: { 
        password: hashedPassword,
        email: user.email.trim().toLowerCase() // Normalize email
      } 
    }
  );

  console.log(`\n✅ Success! Password for "${user.email}" has been reset to "${newPassword}".`);
  console.log(`👉 You can now log in at https://dinedesk-ten.vercel.app/login`);
  await conn.close();
}

run().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
