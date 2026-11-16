import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';

// 1. Target your specific migrations directory
const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');
const META_DIR = path.join(MIGRATIONS_DIR, 'meta');
const JOURNAL_PATH = path.join(META_DIR, '_journal.json');

if (!fs.existsSync(MIGRATIONS_DIR) || !fs.existsSync(META_DIR)) {
  console.error('❌ Migrations directory not found at db/migrations');
  process.exit(1);
}

// Resolve committed conflict markers from main without overwriting unrelated
// metadata files or depending on an active Git merge.
const metadataFiles = fs
  .readdirSync(META_DIR)
  .filter((file) => file.endsWith('.json'));
for (const file of metadataFiles) {
  const filePath = path.join(META_DIR, file);
  if (fs.readFileSync(filePath, 'utf8').includes('<<<<<<<')) {
    console.log(`⚡ Resolving conflict markers in ${file} from main...`);
    const repositoryPath = path.relative(process.cwd(), filePath);
    const content = execFileSync('git', ['show', `main:${repositoryPath}`], {
      encoding: 'utf8',
    });
    fs.writeFileSync(filePath, content);
  }
}

// 3. Inspect SQL files and find index conflicts
const files = fs.readdirSync(MIGRATIONS_DIR).sort();
const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8')) as {
  entries: { idx: number; tag: string }[];
};

const validTags = new Set(journal.entries.map((e) => e.tag));
const validIndexes = new Set(journal.entries.map((e) => e.idx));

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
    if (!validIndexes.has(Number(idxStr)) && fs.existsSync(snapshotPath)) {
      console.log(`🗑️ Removing conflicting snapshot: ${idxStr}_snapshot.json`);
      fs.unlinkSync(snapshotPath);
    }
  }
}

// 4. Regenerate clean migrations for local schema changes
console.log('🔄 Regenerating migration files...');
execSync('pnpm db:generate', { stdio: 'inherit' });
console.log('✅ Drizzle migration conflicts successfully resolved!');
