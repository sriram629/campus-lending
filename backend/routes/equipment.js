import { Router } from 'express';
import db from '../db.js';
import { body, text, id, fail } from '../validation.js';

const router = Router();

router.get('/categories', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM categories ORDER BY name');
  res.json(rows);
});
router.post('/categories', async (req, res) => {
  const name = text(body(req.body), 'name', 80);
  const [result] = await db.execute('INSERT INTO categories (name) VALUES (?)', [name]);
  res.status(201).json({ id: result.insertId });
});
router.put('/categories/:id', async (req, res) => {
  const [result] = await db.execute('UPDATE categories SET name = ? WHERE id = ?', [text(body(req.body), 'name', 80), id(req.params.id)]);
  if (!result.affectedRows) fail(404, 'Category not found.');
  res.json({ message: 'Category updated.' });
});
router.delete('/categories/:id', async (req, res) => {
  const [result] = await db.execute('DELETE FROM categories WHERE id = ?', [id(req.params.id)]);
  if (!result.affectedRows) fail(404, 'Category not found.');
  res.json({ message: 'Category deleted.' });
});

router.get('/', async (req, res) => {
  const [rows] = await db.query(`SELECT e.*, c.name AS category,
    (SELECT COUNT(*) FROM loan_items li WHERE li.equipment_id = e.id AND li.returned_on IS NULL) AS on_loan
    FROM equipment e JOIN categories c ON c.id = e.category_id ORDER BY e.asset_tag`);
  res.json(rows.map(item => ({ ...item, available: item.quantity - item.maintenance_quantity - item.on_loan })));
});

function values(data) {
  body(data);
  if (!Number.isInteger(data.quantity) || data.quantity < 0 || data.quantity > 10000 ||
      !Number.isInteger(data.maintenance_quantity) || data.maintenance_quantity < 0 || data.maintenance_quantity > data.quantity)
    fail(400, 'Enter whole stock counts between 0 and 10000. Maintenance cannot exceed total stock.');
  return [text(data, 'asset_tag', 40), text(data, 'name'), id(data.category_id), text(data, 'location'), data.quantity, data.maintenance_quantity];
}

router.post('/', async (req, res) => {
  const [result] = await db.execute(`INSERT INTO equipment
    (asset_tag, name, category_id, location, quantity, maintenance_quantity) VALUES (?, ?, ?, ?, ?, ?)`, values(req.body));
  res.status(201).json({ id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const recordId = id(req.params.id);
  const data = values(req.body);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [records] = await connection.execute('SELECT id FROM equipment WHERE id = ? FOR UPDATE', [recordId]);
    if (!records.length) fail(404, 'Equipment not found.');
    const [[open]] = await connection.execute('SELECT COUNT(*) AS total FROM loan_items WHERE equipment_id = ? AND returned_on IS NULL', [recordId]);
    if (data[4] - data[5] < open.total) fail(409, 'Total stock must cover borrowed items and maintenance items.');
    await connection.execute(`UPDATE equipment SET asset_tag = ?, name = ?, category_id = ?, location = ?,
      quantity = ?, maintenance_quantity = ? WHERE id = ?`, [...data, recordId]);
    await connection.commit();
    res.json({ message: 'Equipment updated.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
router.delete('/:id', async (req, res) => {
  const [result] = await db.execute('DELETE FROM equipment WHERE id = ?', [id(req.params.id)]);
  if (!result.affectedRows) fail(404, 'Equipment not found.');
  res.json({ message: 'Equipment deleted.' });
});
export default router;
