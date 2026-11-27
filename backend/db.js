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
    const [[counts]] = await db.query(`SELECT
      (SELECT COUNT(*) FROM categories) + (SELECT COUNT(*) FROM borrowers) +
      (SELECT COUNT(*) FROM equipment) + (SELECT COUNT(*) FROM loans) AS total`);
    if (counts.total === 0) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          "INSERT INTO categories (name) VALUES ('Photography'), ('Computing'), ('Audio'), ('Presentation')",
        );
        await connection.query(`INSERT INTO borrowers (campus_id, name, email, department) VALUES
          ('STU-1001', 'Maya Patel', 'maya@example.edu', 'Media Studies'),
          ('STU-1002', 'Alex Rivera', 'alex@example.edu', 'Computer Science'),
          ('STU-1003', 'Jordan Lee', 'jordan@example.edu', 'Architecture')`);
        await connection.query(`INSERT INTO equipment (asset_tag, name, category_id, location, item_condition, service_status) VALUES
          ('CAM-001', 'Canon EOS camera', (SELECT id FROM categories WHERE name = 'Photography'), 'Media lab', 'Good', 'Ready'),
          ('CAM-002', 'Sony mirrorless camera', (SELECT id FROM categories WHERE name = 'Photography'), 'Media lab', 'Good', 'Ready'),
          ('LAP-001', 'Dell Latitude laptop', (SELECT id FROM categories WHERE name = 'Computing'), 'Library desk', 'Good', 'Ready'),
          ('LAP-002', 'Lenovo ThinkPad', (SELECT id FROM categories WHERE name = 'Computing'), 'Library desk', 'Fair', 'Ready'),
          ('MIC-001', 'Wireless microphone kit', (SELECT id FROM categories WHERE name = 'Audio'), 'Media lab', 'Good', 'Ready'),
          ('PRO-001', 'Epson projector', (SELECT id FROM categories WHERE name = 'Presentation'), 'Library desk', 'Needs repair', 'Maintenance')`);
        await connection.query(`INSERT INTO loans (borrower_id, issued_on, due_on, notes) VALUES
          ((SELECT id FROM borrowers WHERE campus_id = 'STU-1001'), CURRENT_DATE - INTERVAL 5 DAY, CURRENT_DATE - INTERVAL 2 DAY, 'Sample photography loan'),
          ((SELECT id FROM borrowers WHERE campus_id = 'STU-1002'), CURRENT_DATE - INTERVAL 2 DAY, CURRENT_DATE + INTERVAL 4 DAY, 'Sample class project')`);
        await connection.query(
          `INSERT INTO loan_items (loan_id, equipment_id)
          SELECT l.id, e.id FROM loans l
          JOIN borrowers b ON b.id = l.borrower_id
          JOIN equipment e ON (b.campus_id = 'STU-1001' AND e.asset_tag = 'CAM-001')
            OR (b.campus_id = 'STU-1002' AND e.asset_tag = 'LAP-001')`,
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
  } catch (error) {
    console.error("Database setup failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
