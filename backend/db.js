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
  connectionLimit: 5,
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
    // Upgrade the original individual-asset schema without removing loan history.
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
    const seedCatalog = counts.total === 0 || process.argv.includes("--demo");
    if (counts.total === 0) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          "INSERT INTO categories (name) VALUES ('Photography'), ('Computing'), ('Audio'), ('Presentation')",
        );
        await connection.query(`INSERT INTO borrowers (campus_id, name, email, department) VALUES
          ('S00480001', 'Maya Patel', 'maya@example.edu', 'Media Studies'),
          ('S00480002', 'Alex Rivera', 'alex@example.edu', 'Computer Science'),
          ('S00480003', 'Jordan Lee', 'jordan@example.edu', 'Architecture')`);
        await connection.query(`INSERT INTO equipment (asset_tag, name, category_id, location, quantity, maintenance_quantity) VALUES
          ('CAM-001', 'Canon EOS camera', (SELECT id FROM categories WHERE name = 'Photography'), 'Media lab', 5, 0),
          ('CAM-002', 'Sony mirrorless camera', (SELECT id FROM categories WHERE name = 'Photography'), 'Media lab', 5, 0),
          ('LAP-001', 'Dell Latitude laptop', (SELECT id FROM categories WHERE name = 'Computing'), 'Library desk', 5, 0),
          ('LAP-002', 'Lenovo ThinkPad', (SELECT id FROM categories WHERE name = 'Computing'), 'Library desk', 5, 0),
          ('MIC-001', 'Wireless microphone kit', (SELECT id FROM categories WHERE name = 'Audio'), 'Media lab', 5, 0),
          ('PRO-001', 'Epson projector', (SELECT id FROM categories WHERE name = 'Presentation'), 'Library desk', 2, 1)`);
        await connection.query(`INSERT INTO loans (borrower_id, issued_on, due_on, notes) VALUES
          ((SELECT id FROM borrowers WHERE campus_id = 'S00480001'), CURRENT_DATE - INTERVAL 5 DAY, CURRENT_DATE - INTERVAL 2 DAY, 'Sample photography loan'),
          ((SELECT id FROM borrowers WHERE campus_id = 'S00480002'), CURRENT_DATE - INTERVAL 2 DAY, CURRENT_DATE + INTERVAL 4 DAY, 'Sample class project')`);
        await connection.query(
          `INSERT INTO loan_items (loan_id, equipment_id)
          SELECT l.id, e.id FROM loans l
          JOIN borrowers b ON b.id = l.borrower_id
          JOIN equipment e ON (b.campus_id = 'S00480001' AND e.asset_tag = 'CAM-001')
            OR (b.campus_id = 'S00480002' AND e.asset_tag = 'LAP-001')`,
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      console.log("Schema created with sample records.");
    } else {
      console.log("Schema checked. Existing records were preserved.");
    }
    if (seedCatalog) {
      const catalog = [
        ['TRI-001', 'Camera tripod', 'Photography', 8], ['LEN-001', 'Portrait lens', 'Photography', 2],
        ['LIT-001', 'LED lighting kit', 'Photography', 4], ['REC-001', 'Audio recorder', 'Audio', 4],
        ['HDP-001', 'Studio headphones', 'Audio', 10], ['SPK-001', 'Portable speaker', 'Audio', 5],
        ['TAB-001', 'Drawing tablet', 'Computing', 6], ['IPD-001', 'iPad', 'Computing', 8],
        ['CAL-001', 'Scientific calculator', 'Computing', 20], ['CHR-001', 'USB-C charger', 'Computing', 20],
        ['ADP-001', 'HDMI adapter', 'Presentation', 15], ['REM-001', 'Presentation remote', 'Presentation', 10],
        ['SCR-001', 'Projection screen', 'Presentation', 4], ['VR-001', 'VR headset', 'Computing', 2],
        ['WEB-001', 'Webcam', 'Computing', 8], ['KEY-001', 'Wireless keyboard', 'Computing', 10],
        ['MOU-001', 'Wireless mouse', 'Computing', 15], ['GIM-001', 'Camera gimbal', 'Photography', 2],
        ['CAM-001', 'Canon EOS camera', 'Photography', 5], ['CAM-002', 'Sony mirrorless camera', 'Photography', 3],
        ['LAP-001', 'Dell Latitude laptop', 'Computing', 10], ['LAP-002', 'Lenovo ThinkPad', 'Computing', 8]
      ];
      for (const [tag, name, category, quantity] of catalog) {
        await db.execute('INSERT IGNORE INTO categories (name) VALUES (?)', [category]);
        await db.execute(`INSERT INTO equipment (asset_tag, name, category_id, location, quantity)
          SELECT ?, ?, id, 'Library desk', ? FROM categories WHERE name = ?
          ON DUPLICATE KEY UPDATE quantity = GREATEST(quantity, ?)`, [tag, name, quantity, category, quantity]);
      }
      console.log('Demo equipment catalog ready.');
    }
  } catch (error) {
    console.error("Database setup failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
