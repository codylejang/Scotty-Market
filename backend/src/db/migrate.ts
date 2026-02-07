import path from 'path';
import fs from 'fs';
import { initDb } from './database';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Running migrations...');
initDb();
console.log('Migrations complete.');
