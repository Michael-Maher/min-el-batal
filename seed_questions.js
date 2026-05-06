/**
 * seed_questions.js
 * Deletes all existing tournament_questions and uploads the new set.
 * Run: node seed_questions.js
 */

const path = require('path');
const admin = require(path.join(__dirname, 'functions/node_modules/firebase-admin'));
const questions = require('./new_questions.json');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'min-el-batal',
});

const db = admin.firestore();

async function seed() {
  console.log('=== Starting question seed ===');
  const col = db.collection('tournament_questions');

  // 1. Delete existing documents
  console.log('Deleting existing questions...');
  const existing = await col.get();
  let deleted = 0;
  const DEL_BATCH_SIZE = 400;
  for (let i = 0; i < existing.docs.length; i += DEL_BATCH_SIZE) {
    const batch = db.batch();
    existing.docs.slice(i, i + DEL_BATCH_SIZE).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += Math.min(DEL_BATCH_SIZE, existing.docs.length - i);
    console.log(`  Deleted ${deleted}/${existing.docs.length}`);
  }
  console.log(`Deleted ${deleted} existing questions.`);

  // 2. Upload new questions
  console.log(`Uploading ${questions.length} new questions...`);
  const BATCH_SIZE = 400;
  let uploaded = 0;
  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = db.batch();
    questions.slice(i, i + BATCH_SIZE).forEach(q => {
      const ref = col.doc(); // auto-ID
      batch.set(ref, {
        type: q.type,
        text: q.text,
        answer: q.answer || '',
        notes: q.notes || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    uploaded += Math.min(BATCH_SIZE, questions.length - i);
    console.log(`  Uploaded ${uploaded}/${questions.length}`);
  }

  console.log('\n=== Done! ===');
  console.log(`Total uploaded: ${uploaded} questions`);

  // Summary by type
  const byType = {};
  questions.forEach(q => { byType[q.type] = (byType[q.type] || 0) + 1; });
  console.log('\nBy type:');
  Object.entries(byType).sort().forEach(([t, n]) => console.log(`  ${t}: ${n}`));

  process.exit(0);
}

seed().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
