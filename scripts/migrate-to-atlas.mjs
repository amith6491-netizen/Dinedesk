import mongoose from 'mongoose';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Fix for Windows / ISP DNS SRV lookup failures
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Ignore
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_URI = 'mongodb://127.0.0.1:27017';

let ATLAS_URI = process.env.MONGODB_URI;
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const match = envFile.match(/MONGODB_URI=["']?([^"'\r\n]+)["']?/);
    if (match) ATLAS_URI = match[1];
  }
} catch {
  // Use fallback
}

if (!ATLAS_URI || ATLAS_URI.includes('127.0.0.1')) {
  ATLAS_URI = 'mongodb+srv://dinedesk-admin:7899472591@cluster0.0vcsdkb.mongodb.net/dinedesk?retryWrites=true&w=majority';
}

async function migrate() {
  console.log('🔄 Connecting to databases...');
  
  const localClient = await mongoose.createConnection(LOCAL_URI, {
    serverSelectionTimeoutMS: 5000,
  }).asPromise();
  console.log('✅ Connected to Local MongoDB');

  const atlasConn = await mongoose.createConnection(ATLAS_URI, {
    serverSelectionTimeoutMS: 10000,
  }).asPromise();
  console.log('✅ Connected to MongoDB Atlas');

  // Discover all databases on local MongoDB
  const adminDb = localClient.db.admin();
  const { databases } = await adminDb.listDatabases();
  console.log('\n🔎 Scanning local databases:');

  const candidateDbs = databases
    .map(d => d.name)
    .filter(name => !['admin', 'config', 'local'].includes(name));

  console.log('   Databases found:', candidateDbs.length > 0 ? candidateDbs.join(', ') : 'None (empty)');

  let totalMigrated = 0;

  for (const dbName of candidateDbs) {
    const localDb = localClient.useDb(dbName);
    const collections = await localDb.db.listCollections().toArray();

    for (const { name: colName } of collections) {
      const docs = await localDb.db.collection(colName).find({}).toArray();
      if (docs.length > 0) {
        console.log(`\n📦 Found ${docs.length} document(s) in local db "${dbName}" -> collection "${colName}":`);
        for (const doc of docs) {
          if (doc.email) {
            console.log(`   👤 User found: ${doc.email} (Name: ${doc.name || 'N/A'}, Role: ${doc.role || 'CUSTOMER'})`);
          }
          await atlasConn.collection(colName).replaceOne(
            { _id: doc._id },
            doc,
            { upsert: true }
          );
          totalMigrated++;
        }
        console.log(`   ✅ Transferred to MongoDB Atlas!`);
      }
    }
  }

  await localClient.close();
  await atlasConn.close();

  if (totalMigrated > 0) {
    console.log(`\n🎉 Success! Migrated ${totalMigrated} document(s) to MongoDB Atlas.`);
  } else {
    console.log('\nℹ️  Notice: No local users or records exist on your local MongoDB.');
    console.log('   (They may have been deleted by clean-users or stored under a different setup).');
    console.log('   👉 Simply register a new account on https://dinedesk-ten.vercel.app/register !');
  }
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
