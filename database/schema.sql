CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS borrowers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campus_id VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  department VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  restricted BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (restricted IN (0, 1)),
  CHECK (active IN (0, 1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS equipment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_tag VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  category_id INT NOT NULL,
  location VARCHAR(120) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  maintenance_quantity INT NOT NULL DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  CHECK (quantity >= 0 AND maintenance_quantity >= 0 AND maintenance_quantity <= quantity)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  borrower_id INT NOT NULL,
  issued_on DATE NOT NULL,
  due_on DATE NOT NULL,
  notes VARCHAR(1000) NOT NULL DEFAULT '',
  FOREIGN KEY (borrower_id) REFERENCES borrowers(id),
  CHECK (due_on >= issued_on)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS loan_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL,
  equipment_id INT NOT NULL,
  returned_on DATE DEFAULT NULL,
  damaged BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  FOREIGN KEY (equipment_id) REFERENCES equipment(id),
  UNIQUE (loan_id, equipment_id)
) ENGINE=InnoDB;
