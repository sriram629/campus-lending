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
    CASE WHEN EXISTS (SELECT 1 FROM loan_items li WHERE li.equipment_id = e.id AND li.returned_on IS NULL)
    THEN 'On loan' ELSE e.service_status END AS availability
    FROM equipment e JOIN categories c ON c.id = e.category_id ORDER BY e.asset_tag`);
  res.json(rows);
});

function values(data) {
  body(data);
  const condition = text(data, 'item_condition');
  const status = text(data, 'service_status');
  if (!['Good', 'Fair', 'Needs repair'].includes(condition) || !['Ready', 'Maintenance', 'Retired'].includes(status)) {
    fail(400, 'Choose a valid condition and service status.');
  }
  if (condition === 'Needs repair' && status === 'Ready') fail(400, 'Equipment needing repair must be in maintenance or retired.');
  return [text(data, 'asset_tag', 40), text(data, 'name'), id(data.category_id), text(data, 'location'), condition, status];
}

router.post('/', async (req, res) => {
  const [result] = await db.execute(`INSERT INTO equipment
    (asset_tag, name, category_id, location, item_condition, service_status) VALUES (?, ?, ?, ?, ?, ?)`, values(req.body));
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
    const [open] = await connection.execute('SELECT id FROM loan_items WHERE equipment_id = ? AND returned_on IS NULL', [recordId]);
    if (open.length && data[5] !== 'Ready') fail(409, 'Return this item before changing its service status.');
    await connection.execute(`UPDATE equipment SET asset_tag = ?, name = ?, category_id = ?, location = ?,
      item_condition = ?, service_status = ? WHERE id = ?`, [...data, recordId]);
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
