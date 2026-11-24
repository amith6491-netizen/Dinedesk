import mongoose from 'mongoose';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// DNS SRV fix for Windows / ISP DNS issues
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Ignore
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongoUri = process.env.MONGODB_URI;

try {
  for (const envFileName of ['.env', '.env.local']) {
    const envPath = path.join(__dirname, '..', envFileName);
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf8');
      const match = envFile.match(/MONGODB_URI=["']?([^"'\r\n]+)["']?/);
      if (match && match[1] && !match[1].includes('127.0.0.1')) {
        mongoUri = match[1];
        break;
      }
    }
  }
} catch {
  // Use default
}

if (!mongoUri) {
  mongoUri = 'mongodb://127.0.0.1:27017/dinedesk';
}

const email = process.argv[2];
const role = (process.argv[3] || 'ADMIN').toUpperCase();

if (!email) {
  console.log('Usage: npm run set-admin <email> [ADMIN|STAFF|CUSTOMER]');
  console.log('Example: npm run set-admin john@example.com ADMIN');
  process.exit(1);
}

async function run() {
  let updated = false;

  // 1. Try direct connection
  try {
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    if (db) {
      const result = await db.collection('users').updateOne(
        { email: email.toLowerCase() },
        { $set: { role } }
      );
      if (result.matchedCount > 0) {
        updated = true;
      }
    }
  } catch {
    // Continue to check Docker
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      // Ignore disconnect error
    }
  }

  // 2. Try Docker container if not updated yet
  if (!updated) {
    try {
      const script = `db.users.updateOne({ email: "${email.toLowerCase()}" }, { $set: { role: "${role}" } });`;
      const dockerRes = execSync(
        `docker exec -i dinedesk-mongodb mongosh dinedesk --quiet`,
        { input: script, stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' }
      );
      if (dockerRes.includes('matchedCount: 1') || dockerRes.includes('"matchedCount":1') || dockerRes.includes('matchedCount:1')) {
        updated = true;
      }
    } catch {
      // Docker container not running
    }
  }

  if (updated) {
    console.log(`✅ Success: User "${email}" role set to "${role}"!`);
  } else {
    console.log(`❌ User with email "${email}" not found in database.`);
    console.log('Please register first at http://localhost:3000/register (or http://localhost:3001/register)');
  }
}

run();
