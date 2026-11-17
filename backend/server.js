import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import equipment from './routes/equipment.js';
import borrowers from './routes/borrowers.js';
import loans from './routes/loans.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.get('/api/health', async (req, res) => {
  await db.query('SELECT 1 FROM categories LIMIT 1');
  res.json({ status: 'ok', database: 'connected' });
});
app.use('/api/equipment', equipment);
app.use('/api/borrowers', borrowers);
app.use('/api/loans', loans);
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

const frontend = fileURLToPath(new URL('../frontend/dist', import.meta.url));
if (existsSync(frontend)) {
  app.use(express.static(frontend));
  app.get('/{*path}', (req, res) => res.sendFile(`${frontend}/index.html`));
}
app.use((error, req, res, next) => {
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This asset tag, campus ID, email, category, or active loan already exists.' });
  if (['ER_ROW_IS_REFERENCED_2', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) {
    return res.status(409).json({ error: 'This record is linked to other data. Retire equipment or deactivate borrowers to preserve loan history.' });
  }
  if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) return res.status(409).json({ error: 'Another request is changing this record. Please try again.' });
  if (['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR'].includes(error.code)) {
    return res.status(503).json({ error: 'Database unavailable. Check that MySQL is running and backend settings are correct.' });
  }
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Send valid JSON.' });
  if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message });
  console.error('Request failed:', error.code || error.name);
  res.status(500).json({ error: 'The request could not be completed.' });
});

const port = Number(process.env.PORT || 5002);
const host = process.env.HOST || '127.0.0.1';
try {
  await db.query('SELECT 1 FROM categories LIMIT 1');
  app.listen(port, host, () => console.log(`Campus Lending API: http://${host}:${port}`));
} catch (error) {
  console.error('Startup failed. Check MySQL, backend/.env, and npm run db:setup.', error.code || error.name);
  await db.end();
  process.exitCode = 1;
}
