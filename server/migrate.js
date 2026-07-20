import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTITIES_DIR = path.join(__dirname, '..', 'base44', 'entities');

function stripJsonc(text) {
  return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
}

function sqlType(prop) {
  if (prop.enum) return 'VARCHAR(64)';
  switch (prop.type) {
    case 'number':
    case 'integer':
      return prop.type === 'integer' ? 'INT' : 'DOUBLE';
    case 'boolean':
      return 'TINYINT(1)';
    case 'array':
    case 'object':
      return 'JSON';
    case 'string':
    default:
      return prop.format === 'date' || prop.format === 'date-time' ? 'DATETIME' : 'VARCHAR(512)';
  }
}

async function run() {
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  };
  const dbName = process.env.DB_NAME || 'keeppeer_school';
  const admin = await mysql.createConnection(cfg);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  const { pool } = await import('./db.js');

  // users table
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(32) DEFAULT 'user',
    password VARCHAR(255),
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  console.log('✓ users');

  const files = fs.existsSync(ENTITIES_DIR)
    ? fs.readdirSync(ENTITIES_DIR).filter((f) => f.endsWith('.jsonc'))
    : [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf8');
    const def = JSON.parse(stripJsonc(raw));
    const table = def.name.toLowerCase();
    const cols = [
      'id VARCHAR(36) PRIMARY KEY',
      'created_date DATETIME DEFAULT CURRENT_TIMESTAMP',
      'updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'created_by_id VARCHAR(36) NULL',
    ];
    for (const [key, prop] of Object.entries(def.properties || {})) {
      cols.push(`\`${key}\` ${sqlType(prop)}`);
    }
    const ddl = `CREATE TABLE IF NOT EXISTS \`${table}\` (${cols.join(', ')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
    await pool.query(ddl);
    console.log('✓', table);
  }

  console.log('\nMigration complete.');
  process.exit(0);
}

run().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});