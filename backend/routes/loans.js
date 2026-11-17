import { Router } from 'express';
import db from '../db.js';
import { body, id, ids, date, notes, fail } from '../validation.js';

const router = Router();
router.get('/', async (req, res) => {
  const [loans] = await db.query(`SELECT l.*, b.name AS borrower, b.campus_id,
    CASE WHEN NOT EXISTS (SELECT 1 FROM loan_items li WHERE li.loan_id = l.id AND li.returned_on IS NULL)
      THEN 'Returned' WHEN l.due_on < CURRENT_DATE THEN 'Overdue' ELSE 'Active' END AS status
    FROM loans l JOIN borrowers b ON b.id = l.borrower_id ORDER BY l.id DESC`);
  const [items] = await db.query(`SELECT li.id, li.loan_id, li.equipment_id, li.returned_on, e.name, e.asset_tag
    FROM loan_items li JOIN equipment e ON e.id = li.equipment_id ORDER BY li.id`);
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.loan_id)) grouped.set(item.loan_id, []);
    grouped.get(item.loan_id).push(item);
  }
  res.json(loans.map(loan => ({ ...loan, items: grouped.get(loan.id) || [] })));
});

router.post('/', async (req, res) => {
  const data = body(req.body);
  const borrowerId = id(data.borrower_id);
  const equipmentIds = ids(data.equipment_ids);
  const due = date(data.due_on);
  const note = notes(data.notes);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[clock]] = await connection.query('SELECT CURRENT_DATE AS today');
    if (due < clock.today) fail(400, 'The due date cannot be before today.');
    const [borrowers] = await connection.execute('SELECT active FROM borrowers WHERE id = ? FOR UPDATE', [borrowerId]);
    if (!borrowers.length) fail(404, 'Borrower not found.');
    if (!borrowers[0].active) fail(409, 'This borrower is inactive.');
    // Lock physical items in ID order before checking their availability.
    for (const equipmentId of equipmentIds) {
      const [assets] = await connection.execute('SELECT service_status FROM equipment WHERE id = ? FOR UPDATE', [equipmentId]);
      if (!assets.length) fail(404, 'Equipment not found.');
      if (assets[0].service_status !== 'Ready') fail(409, 'An item is in maintenance or retired.');
      const [open] = await connection.execute('SELECT id FROM loan_items WHERE equipment_id = ? AND returned_on IS NULL FOR UPDATE', [equipmentId]);
      if (open.length) fail(409, 'An item is already on loan. Refresh the equipment list.');
    }
    const [result] = await connection.execute('INSERT INTO loans (borrower_id, issued_on, due_on, notes) VALUES (?, CURRENT_DATE, ?, ?)', [borrowerId, due, note]);
    for (const equipmentId of equipmentIds) {
      await connection.execute('INSERT INTO loan_items (loan_id, equipment_id) VALUES (?, ?)', [result.insertId, equipmentId]);
    }
    await connection.commit();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.put('/:id', async (req, res) => {
  const recordId = id(req.params.id);
  const data = body(req.body);
  const due = date(data.due_on);
  const [records] = await db.execute('SELECT issued_on FROM loans WHERE id = ?', [recordId]);
  if (!records.length) fail(404, 'Loan not found.');
  if (due < records[0].issued_on) fail(400, 'The due date cannot be before the issue date.');
  const [result] = await db.execute('UPDATE loans SET due_on = ?, notes = ? WHERE id = ?', [due, notes(data.notes), recordId]);
  if (!result.affectedRows) fail(404, 'Loan not found.');
  res.json({ message: 'Loan updated.' });
});

router.post('/:id/return', async (req, res) => {
  const recordId = id(req.params.id);
  const itemIds = ids(body(req.body).item_ids);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [loans] = await connection.execute('SELECT id FROM loans WHERE id = ? FOR UPDATE', [recordId]);
    if (!loans.length) fail(404, 'Loan not found.');
    for (const itemId of itemIds) {
      const [result] = await connection.execute('UPDATE loan_items SET returned_on = CURRENT_DATE WHERE id = ? AND loan_id = ? AND returned_on IS NULL', [itemId, recordId]);
      if (!result.affectedRows) fail(409, 'An item is already returned or does not belong to this loan.');
    }
    await connection.commit();
    res.json({ message: 'Return recorded.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.delete('/:id', async (req, res) => {
  const recordId = id(req.params.id);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [loans] = await connection.execute('SELECT id FROM loans WHERE id = ? FOR UPDATE', [recordId]);
    if (!loans.length) fail(404, 'Loan not found.');
    const [open] = await connection.execute('SELECT id FROM loan_items WHERE loan_id = ? AND returned_on IS NULL', [recordId]);
    if (open.length) fail(409, 'Return every item before deleting this loan.');
    await connection.execute('DELETE FROM loan_items WHERE loan_id = ?', [recordId]);
    await connection.execute('DELETE FROM loans WHERE id = ?', [recordId]);
    await connection.commit();
    res.json({ message: 'Loan deleted.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
export default router;
