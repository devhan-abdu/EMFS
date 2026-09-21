import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// 1. Target your specific migrations directory
const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');
const META_DIR = path.join(MIGRATIONS_DIR, 'meta');
const JOURNAL_PATH = path.join(META_DIR, '_journal.json');

if (!fs.existsSync(MIGRATIONS_DIR) || !fs.existsSync(META_DIR)) {
  console.error('❌ Migrations directory not found at db/migrations');
  process.exit(1);
}

// 2. Resolve git conflict in meta/_journal.json by keeping incoming/upstream state ("theirs")
if (fs.existsSync(JOURNAL_PATH)) {
  const journalContent = fs.readFileSync(JOURNAL_PATH, 'utf8');
  if (journalContent.includes('<<<<<<<')) {
    console.log(
      '⚡ Resolving _journal.json conflict markers using upstream state...',
    );
    execSync(`git checkout --theirs "${META_DIR}"`);
  }
}

// 3. Inspect SQL files and find index conflicts
const files = fs.readdirSync(MIGRATIONS_DIR).sort();
const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8')) as {
  entries: { idx: number; tag: string }[];
};

const validTags = new Set(journal.entries.map((e) => e.tag));

for (const file of files) {
  if (!file.endsWith('.sql')) continue;

  const match = file.match(/^(\d+)_(.*)\.sql$/);
  if (!match) continue;

  const [, idxStr, name] = match;
  const tag = `${idxStr}_${name}`;

  // If the SQL file tag is not recorded in the valid journal, it's an orphaned conflict
  if (!validTags.has(tag)) {
    console.log(`🗑️ Removing conflicting SQL file: ${file}`);
    fs.unlinkSync(path.join(MIGRATIONS_DIR, file));

    // Remove matching orphaned snapshot if present
    const snapshotPath = path.join(META_DIR, `${idxStr}_snapshot.json`);
    if (fs.existsSync(snapshotPath)) {
      console.log(`🗑️ Removing conflicting snapshot: ${idxStr}_snapshot.json`);
      fs.unlinkSync(snapshotPath);
    }
  }
}

// 4. Regenerate clean migrations for local schema changes
console.log('🔄 Regenerating migration files...');
execSync('pnpm db:generate', { stdio: 'inherit' });
console.log('✅ Drizzle migration conflicts successfully resolved!');
