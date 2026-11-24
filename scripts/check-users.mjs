import mongoose from 'mongoose';
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

async function check() {
  console.log('🔄 Connecting to Atlas...');
  const conn = await mongoose.createConnection(ATLAS_URI).asPromise();
  console.log('✅ Connected to Atlas!');

  const users = await conn.collection('users').find({}).toArray();
  console.log(`\n📋 Found ${users.length} user(s) in Atlas:`);
  for (const u of users) {
    console.log(`- Email: "${u.email}" | Name: "${u.name}" | Role: "${u.role}" | HasPassword: ${Boolean(u.password)}`);
  }

  await conn.close();
}

check().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
