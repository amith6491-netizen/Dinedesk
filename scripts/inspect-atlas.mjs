import mongoose from 'mongoose';
import dns from 'node:dns';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {}

const ATLAS_URI = 'mongodb+srv://dinedesk-admin:7899472591@cluster0.0vcsdkb.mongodb.net/?retryWrites=true&w=majority';

async function inspectAtlas() {
  console.log('🔄 Connecting to your MongoDB Atlas cluster...');
  const client = await mongoose.createConnection(ATLAS_URI).asPromise();
  console.log('✅ Connected to MongoDB Atlas cluster!\n');

  const adminDb = client.db.admin();
  const { databases } = await adminDb.listDatabases();

  console.log('📂 DATABASES FOUND ON YOUR CLUSTER:');
  for (const dbInfo of databases) {
    if (['admin', 'config', 'local'].includes(dbInfo.name)) continue;

    console.log(`\n========================================`);
    console.log(`📁 Database: "${dbInfo.name}"`);
    console.log(`========================================`);

    const db = client.useDb(dbInfo.name);
    const collections = await db.db.listCollections().toArray();

    for (const col of collections) {
      const count = await db.db.collection(col.name).countDocuments();
      console.log(`   📄 Collection "${col.name}": ${count} document(s)`);

      if (col.name === 'users') {
        const users = await db.db.collection(col.name).find({}).toArray();
        for (const u of users) {
          console.log(`      👤 User: "${u.email}" (Name: ${u.name || 'N/A'}, Role: ${u.role || 'N/A'})`);
        }
      }
    }
  }

  await client.close();
  console.log('\n✨ Inspection finished.');
}

inspectAtlas().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
