import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL(".env", import.meta.url)),
  quiet: true,
});
for (const key of ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]) {
  if (process.env[key] === undefined)
    throw new Error(`Missing ${key} in backend/.env`);
}

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 5),
  maxIdle: 1,
  idleTimeout: 60000,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  dateStrings: true,
  charset: "utf8mb4",
});
export default db;

if (process.argv.includes("--setup")) {
  try {
    const sql = await readFile(
      new URL("../database/schema.sql", import.meta.url),
      "utf8",
    );
    for (const statement of sql.split(";").filter((part) => part.trim()))
      await db.query(statement);
    const [borrowerColumns] = await db.query('SHOW COLUMNS FROM borrowers');
    if (!borrowerColumns.some(column => column.Field === 'restricted'))
      await db.query('ALTER TABLE borrowers ADD restricted BOOLEAN NOT NULL DEFAULT FALSE, ADD CHECK (restricted IN (0, 1))');
    const [columns] = await db.query('SHOW COLUMNS FROM equipment');
    if (!columns.some(column => column.Field === 'quantity')) {
      await db.query('ALTER TABLE equipment ADD quantity INT NOT NULL DEFAULT 1, ADD maintenance_quantity INT NOT NULL DEFAULT 0');
      await db.query("UPDATE equipment SET maintenance_quantity = 1 WHERE service_status <> 'Ready'");
    }
    const [oldColumns] = await db.query('SHOW COLUMNS FROM equipment');
    if (oldColumns.some(column => column.Field === 'service_status')) {
      const [checks] = await db.query("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'equipment' AND CONSTRAINT_TYPE = 'CHECK'");
      for (const check of checks) await db.query('ALTER TABLE equipment DROP CHECK ??', [check.CONSTRAINT_NAME]);
      await db.query('ALTER TABLE equipment DROP COLUMN item_condition, DROP COLUMN service_status, ADD CHECK (quantity >= 0 AND maintenance_quantity >= 0 AND maintenance_quantity <= quantity)');
    }
    const [itemColumns] = await db.query('SHOW COLUMNS FROM loan_items');
    if (itemColumns.some(column => column.Field === 'active_equipment_id'))
      await db.query('ALTER TABLE loan_items DROP INDEX active_equipment_id, DROP COLUMN active_equipment_id');
    if (!itemColumns.some(column => column.Field === 'damaged'))
      await db.query('ALTER TABLE loan_items ADD damaged BOOLEAN NOT NULL DEFAULT FALSE');
    for (const [oldId, newId] of [['STU-1001', 'S00480001'], ['STU-1002', 'S00480002'], ['STU-1003', 'S00480003']]) {
      await db.execute('UPDATE borrowers SET campus_id = ? WHERE campus_id = ? AND NOT EXISTS (SELECT id FROM (SELECT id FROM borrowers WHERE campus_id = ?) AS existing)', [newId, oldId, newId]);
    }
    const [[counts]] = await db.query(`SELECT
      (SELECT COUNT(*) FROM categories) + (SELECT COUNT(*) FROM borrowers) +
      (SELECT COUNT(*) FROM equipment) + (SELECT COUNT(*) FROM loans) AS total`);
    if (counts.total === 0 || process.argv.includes("--demo")) {
      const sample = await import('../database/sample-data.mjs');
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        for (const name of sample.categories) {
          const [existing] = await connection.execute('SELECT id FROM categories WHERE name = ?', [name]);
          if (!existing.length) await connection.execute('INSERT INTO categories (name) VALUES (?)', [name]);
        }
        for (const person of sample.borrowers) {
          const [existing] = await connection.execute('SELECT id FROM borrowers WHERE campus_id = ?', [person.campusId]);
          if (!existing.length) await connection.execute('INSERT INTO borrowers (campus_id, name, email, department) VALUES (?, ?, ?, ?)', [person.campusId, person.name, person.email, person.department]);
        }
        for (const item of sample.equipment) {
          const [existing] = await connection.execute('SELECT id FROM equipment WHERE asset_tag = ?', [item.code]);
          if (!existing.length) await connection.execute(`INSERT INTO equipment (asset_tag, name, category_id, location, quantity, maintenance_quantity)
            SELECT ?, ?, id, ?, ?, ? FROM categories WHERE name = ?`, [item.code, item.name, item.location, item.quantity, item.maintenance, item.category]);
        }
        for (const loan of sample.loans) {
          const note = `[Demo ${loan.key}] ${loan.purpose}`;
          const [existing] = await connection.execute('SELECT id FROM loans WHERE notes = ?', [note]);
          if (existing.length) continue;
          const [[person]] = await connection.execute('SELECT id, active, restricted FROM borrowers WHERE campus_id = ? FOR UPDATE', [loan.campusId]);
          const [held] = await connection.execute(`SELECT li.equipment_id FROM loan_items li JOIN loans l ON l.id = li.loan_id
            WHERE l.borrower_id = ? AND li.returned_on IS NULL`, [person.id]);
          const open = loan.returnedOffset === null;
          if (open && (!person.active || person.restricted || held.length + loan.equipmentCodes.length > 3))
            throw new Error(`Demo loan ${loan.key} conflicts with student eligibility or quota. No sample changes were saved.`);
          const equipmentIds = [];
          for (const code of loan.equipmentCodes) {
            const [[item]] = await connection.execute('SELECT id, quantity, maintenance_quantity FROM equipment WHERE asset_tag = ? FOR UPDATE', [code]);
            const [borrowed] = await connection.execute('SELECT id FROM loan_items WHERE equipment_id = ? AND returned_on IS NULL FOR UPDATE', [item.id]);
            if (open && (held.some(row => row.equipment_id === item.id) || borrowed.length >= item.quantity - item.maintenance_quantity))
              throw new Error(`Demo loan ${loan.key} conflicts with existing equipment availability. No sample changes were saved.`);
            equipmentIds.push(item.id);
          }
          const [result] = await connection.execute(`INSERT INTO loans (borrower_id, issued_on, due_on, notes)
            VALUES (?, DATE_ADD(CURRENT_DATE, INTERVAL ? DAY), DATE_ADD(CURRENT_DATE, INTERVAL ? DAY), ?)`, [person.id, loan.issuedOffset, loan.dueOffset, note]);
          for (const equipmentId of equipmentIds) await connection.execute(`INSERT INTO loan_items (loan_id, equipment_id, returned_on)
            VALUES (?, ?, DATE_ADD(CURRENT_DATE, INTERVAL ? DAY))`, [result.insertId, equipmentId, loan.returnedOffset]);
        }
        await connection.commit();
        console.log('Sample records loaded from database/sample-data.mjs. Existing records were preserved.');
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else {
      console.log('Schema checked. Existing records were preserved; sample data was not reloaded.');
    }
  } catch (error) {
    console.error("Database setup failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
