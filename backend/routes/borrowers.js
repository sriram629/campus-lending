import { Router } from 'express';
import db from '../db.js';
import { body, text, id, fail } from '../validation.js';

const router = Router();
router.get('/', async (req, res) => {
  const [rows] = await db.query(`SELECT b.*, (SELECT COUNT(*) FROM loans l JOIN loan_items li ON li.loan_id = l.id
    WHERE l.borrower_id = b.id AND li.returned_on IS NULL) AS items_out FROM borrowers b ORDER BY b.name`);
  res.json(rows);
});

router.get('/lookup/:campusId', async (req, res) => {
  if (!/^S00480\d{3}$/.test(req.params.campusId)) fail(400, 'Use a student ID such as S00480001.');
  const [rows] = await db.execute(`SELECT b.*, (SELECT COUNT(*) FROM loans l JOIN loan_items li ON li.loan_id = l.id
    WHERE l.borrower_id = b.id AND li.returned_on IS NULL) AS items_out FROM borrowers b WHERE campus_id = ?`, [req.params.campusId]);
  if (!rows.length) fail(404, 'Student not found. Add the student to Borrowers first.');
  const [items] = await db.execute(`SELECT li.equipment_id, e.name FROM loan_items li JOIN loans l ON l.id = li.loan_id
    JOIN equipment e ON e.id = li.equipment_id WHERE l.borrower_id = ? AND li.returned_on IS NULL`, [rows[0].id]);
  res.json({ ...rows[0], items });
});

function values(data) {
  body(data);
  if (!/^S00480\d{3}$/.test(text(data, 'campus_id', 9))) fail(400, 'Student ID must match S00480 followed by three digits.');
  const email = text(data, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
  if (![0, 1].includes(data.active)) fail(400, 'Choose an active or inactive borrower status.');
  return [text(data, 'campus_id', 40), text(data, 'name'), email, text(data, 'department'), data.active];
}
router.post('/', async (req, res) => {
  const [result] = await db.execute('INSERT INTO borrowers (campus_id, name, email, department, active) VALUES (?, ?, ?, ?, ?)', values(req.body));
  res.status(201).json({ id: result.insertId });
});
router.put('/:id', async (req, res) => {
  const [result] = await db.execute('UPDATE borrowers SET campus_id = ?, name = ?, email = ?, department = ?, active = ? WHERE id = ?', [...values(req.body), id(req.params.id)]);
  if (!result.affectedRows) fail(404, 'Borrower not found.');
  res.json({ message: 'Borrower updated.' });
});
router.patch('/:id/restriction', async (req, res) => {
  const restricted = body(req.body).restricted;
  if (![0, 1].includes(restricted)) fail(400, 'Choose a valid borrowing status.');
  const [result] = await db.execute('UPDATE borrowers SET restricted = ? WHERE id = ?', [restricted, id(req.params.id)]);
  if (!result.affectedRows) fail(404, 'Borrower not found.');
  res.json({ message: restricted ? 'Borrowing restricted.' : 'Borrowing restriction cleared.' });
});
router.delete('/:id', async (req, res) => {
  const [result] = await db.execute('DELETE FROM borrowers WHERE id = ?', [id(req.params.id)]);
  if (!result.affectedRows) fail(404, 'Borrower not found.');
  res.json({ message: 'Borrower deleted.' });
});
export default router;
