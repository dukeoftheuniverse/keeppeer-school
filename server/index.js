import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { sign, hash, compare, authMiddleware } from './auth.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTITIES_DIR = path.join(__dirname, '..', 'base44', 'entities');
const UPLOAD_DIR = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

function stripJsonc(t) { return t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim(); }
function publicUrl(req, name) { return `${req.protocol}://${req.get('host')}/uploads/${name}`; }
function mapSort(sort) {
  return String(sort).split(',').map((s) => {
    s = s.trim();
    return s.startsWith('-') ? `\`${s.slice(1)}\` DESC` : `\`${s}\` ASC`;
  }).join(',');
}
function buildWhere(filterStr) {
  if (!filterStr) return { sql: '', params: [] };
  let q;
  try { q = JSON.parse(filterStr); } catch { return { sql: '', params: [] }; }
  const clauses = [];
  const params = [];
  for (const [k, v] of Object.entries(q)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [op, val] of Object.entries(v)) {
        if (op === '$gte') { clauses.push(`\`${k}\` >= ?`); params.push(val); }
        else if (op === '$lte') { clauses.push(`\`${k}\` <= ?`); params.push(val); }
        else if (op === '$gt') { clauses.push(`\`${k}\` > ?`); params.push(val); }
        else if (op === '$lt') { clauses.push(`\`${k}\` < ?`); params.push(val); }
        else if (op === '$ne') { clauses.push(`\`${k}\` != ?`); params.push(val); }
        else if (op === '$in') { clauses.push(`\`${k}\` IN (?)`); params.push(val); }
      }
    } else {
      clauses.push(`\`${k}\` = ?`); params.push(v);
    }
  }
  return clauses.length ? { sql: ' WHERE ' + clauses.join(' AND '), params } : { sql: '', params: [] };
}

// ---------- Auth ----------
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const id = crypto.randomUUID();
  try {
    await pool.query('INSERT INTO users (id, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [id, email, hash(password), full_name || '', role || 'user']);
    res.json({ id, email, full_name: full_name || '', role: role || 'user', token: sign({ id, email, role: role || 'user' }) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const u = rows[0];
  if (!u || !compare(password, u.password)) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ id: u.id, email: u.email, full_name: u.full_name, role: u.role, token: sign({ id: u.id, email: u.email, role: u.role }) });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not authenticated' });
  const [rows] = await pool.query('SELECT id, email, full_name, role FROM users WHERE id = ?', [req.user.id]);
  res.json(rows[0] || null);
});

app.put('/api/auth/me', authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not authenticated' });
  const { full_name } = req.body || {};
  await pool.query('UPDATE users SET full_name = ? WHERE id = ?', [full_name, req.user.id]);
  const [rows] = await pool.query('SELECT id, email, full_name, role FROM users WHERE id = ?', [req.user.id]);
  res.json(rows[0]);
});

app.delete('/api/auth/logout', (req, res) => res.json({ ok: true }));

app.post('/api/users/invite', authMiddleware, async (req, res) => {
  const { email, role } = req.body || {};
  const id = crypto.randomUUID();
  try {
    await pool.query('INSERT INTO users (id, email, role, password) VALUES (?, ?, ?, ?)',
      [id, email, role || 'user', hash(crypto.randomUUID())]);
    res.json({ ok: true, id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- Generic entity CRUD ----------
app.get('/api/entities/:name', authMiddleware, async (req, res) => {
  const table = req.params.name.toLowerCase();
  const { filter, sort, limit, skip } = req.query;
  let sql = `SELECT * FROM \`${table}\``;
  const where = buildWhere(filter);
  sql += where.sql;
  if (sort) sql += ` ORDER BY ${mapSort(sort)}`;
  if (limit) sql += ` LIMIT ${parseInt(limit) || 100}`;
  if (skip) sql += ` OFFSET ${parseInt(skip) || 0}`;
  try { const [rows] = await pool.query(sql, where.params); res.json(rows); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/entities/:name/schema', async (req, res) => {
  try {
    const raw = fs.readFileSync(path.join(ENTITIES_DIR, req.params.name + '.jsonc'), 'utf8');
    const def = JSON.parse(stripJsonc(raw));
    res.json({ type: 'object', properties: def.properties || {}, required: def.required || [] });
  } catch { res.json({ type: 'object', properties: {}, required: [] }); }
});

app.get('/api/entities/:name/:id', authMiddleware, async (req, res) => {
  const [rows] = await pool.query(`SELECT * FROM \`${req.params.name.toLowerCase()}\` WHERE id = ?`, [req.params.id]);
  res.json(rows[0] || null);
});

app.post('/api/entities/:name', authMiddleware, async (req, res) => {
  const table = req.params.name.toLowerCase();
  const data = { ...req.body, id: req.body.id || crypto.randomUUID(), created_date: new Date(), updated_date: new Date(), created_by_id: req.user?.id };
  const keys = Object.keys(data);
  const sql = `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  try { await pool.query(sql, keys.map((k) => data[k])); res.json(data); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/entities/:name/bulk', authMiddleware, async (req, res) => {
  const table = req.params.name.toLowerCase();
  const arr = Array.isArray(req.body) ? req.body : [];
  const out = [];
  for (const item of arr) {
    const data = { ...item, id: item.id || crypto.randomUUID(), created_date: new Date(), updated_date: new Date(), created_by_id: req.user?.id };
    const keys = Object.keys(data);
    const sql = `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    try { await pool.query(sql, keys.map((k) => data[k])); out.push(data); } catch { /* skip failed */ }
  }
  res.json(out);
});

app.put('/api/entities/:name/:id', authMiddleware, async (req, res) => {
  const table = req.params.name.toLowerCase();
  const data = { ...req.body, updated_date: new Date() };
  delete data.id;
  const keys = Object.keys(data);
  if (keys.length) {
    const sql = `UPDATE \`${table}\` SET ${keys.map((k) => `\`${k}\`=?`).join(',')} WHERE id = ?`;
    await pool.query(sql, [...keys.map((k) => data[k]), req.params.id]);
  }
  const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [req.params.id]);
  res.json(rows[0]);
});

app.post('/api/entities/:name/updateMany', authMiddleware, async (req, res) => {
  const table = req.params.name.toLowerCase();
  const { filter, set } = req.body || {};
  const where = buildWhere(filter ? JSON.stringify(filter) : '');
  const setObj = set && set.$set ? set.$set : set || {};
  const keys = Object.keys(setObj);
  if (!keys.length) return res.json({ updated: 0 });
  const sql = `UPDATE \`${table}\` SET ${keys.map((k) => `\`${k}\`=?`).join(',')} ${where.sql}`;
  await pool.query(sql, [...keys.map((k) => setObj[k]), ...where.params]);
  res.json({ updated: 1 });
});

app.post('/api/entities/:name/bulkUpdate', authMiddleware, async (req, res) => {
  const table = req.params.name.toLowerCase();
  const arr = Array.isArray(req.body) ? req.body : [];
  for (const item of arr) {
    const id = item.id;
    if (!id) continue;
    const data = { ...item, updated_date: new Date() };
    delete data.id;
    const keys = Object.keys(data);
    if (keys.length) await pool.query(`UPDATE \`${table}\` SET ${keys.map((k) => `\`${k}\`=?`).join(',')} WHERE id=?`, [...keys.map((k) => data[k]), id]);
  }
  res.json({ updated: arr.length });
});

app.delete('/api/entities/:name/:id', authMiddleware, async (req, res) => {
  await pool.query(`DELETE FROM \`${req.params.name.toLowerCase()}\` WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/entities/:name/deleteMany', authMiddleware, async (req, res) => {
  const where = buildWhere(JSON.stringify(req.body || {}));
  await pool.query(`DELETE FROM \`${req.params.name.toLowerCase()}\` ${where.sql}`, where.params);
  res.json({ ok: true });
});

// ---------- Integrations (local stubs) ----------
const upload = multer({ storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) }) });
app.post('/api/uploads', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  res.json({ file_url: publicUrl(req, req.file.filename) });
});

app.post('/api/integrations/email', authMiddleware, (req, res) => {
  console.log('[email]', req.body?.to, req.body?.subject);
  res.json({ ok: true, stub: true });
});
app.post('/api/integrations/llm', authMiddleware, (req, res) => {
  res.json({ response: `[LLM stub] ${String(req.body?.prompt || '').slice(0, 200)}`, stub: true });
});
app.post('/api/integrations/image', authMiddleware, (req, res) => res.json({ url: '', stub: true }));
app.post('/api/integrations/speech', authMiddleware, (req, res) => res.json({ url: '', stub: true }));
app.post('/api/integrations/video', authMiddleware, (req, res) => res.json({ url: '', stub: true }));
app.post('/api/integrations/transcribe', authMiddleware, (req, res) => res.json({ text: '', stub: true }));
app.post('/api/analytics/track', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`KeepPeer School API → http://localhost:${PORT}`));