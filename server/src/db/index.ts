import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import path from "node:path";
import fs from "node:fs";

const dbDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.resolve(dbDir, "messmate.db");
const client = createClient({
  url: `file:${dbPath}`,
});

export const db = drizzle(client, { schema });

// Helper function to initialize all tables
export async function initializeDatabase() {
  await client.execute("PRAGMA foreign_keys = ON;");
  await client.execute("PRAGMA journal_mode = WAL;");

  // Create tables if they do not exist
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      semester INTEGER NOT NULL DEFAULT 5,
      room_number TEXT NOT NULL,
      phone TEXT,
      qr_token TEXT NOT NULL UNIQUE,
      qr_issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      qr_status TEXT NOT NULL DEFAULT 'ACTIVE'
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 1,
      default_advance_one_sem REAL NOT NULL DEFAULT 25000,
      default_advance_two_sem REAL NOT NULL DEFAULT 50000
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS messes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      monthly_fee REAL NOT NULL DEFAULT 3800,
      cuisine_type TEXT NOT NULL,
      daily_meal_count INTEGER NOT NULL DEFAULT 3,
      is_active INTEGER NOT NULL DEFAULT 1,
      image_url TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS monthly_mess_windows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      semester_id INTEGER NOT NULL REFERENCES semesters(id),
      month_year TEXT NOT NULL UNIQUE,
      open_date TEXT NOT NULL,
      deadline_date TEXT NOT NULL,
      lock_date TEXT NOT NULL,
      is_locked INTEGER NOT NULL DEFAULT 0
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS monthly_mess_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      month_year TEXT NOT NULL,
      mess_id INTEGER NOT NULL REFERENCES messes(id),
      fee_charged REAL NOT NULL,
      selected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_at TEXT,
      overridden_by_admin_id INTEGER REFERENCES users(id),
      override_reason TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS addons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      unit_price REAL NOT NULL,
      available_days_of_week TEXT NOT NULL,
      meal_slot TEXT NOT NULL,
      max_daily_capacity INTEGER NOT NULL DEFAULT 300,
      is_active INTEGER NOT NULL DEFAULT 1,
      icon_name TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS addon_availabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      addon_id INTEGER NOT NULL REFERENCES addons(id),
      specific_date TEXT NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      override_price REAL,
      max_capacity INTEGER
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS addon_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      addon_id INTEGER NOT NULL REFERENCES addons(id),
      specific_date TEXT NOT NULL,
      meal_slot TEXT NOT NULL,
      unit_price REAL NOT NULL,
      selected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'CONFIRMED'
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS entitlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      entitlement_type TEXT NOT NULL,
      reference_id INTEGER,
      item_name TEXT NOT NULL,
      applicable_date TEXT NOT NULL,
      meal_slot TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS redemption_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entitlement_id INTEGER NOT NULL UNIQUE REFERENCES entitlements(id),
      student_id INTEGER NOT NULL REFERENCES students(id),
      staff_user_id INTEGER NOT NULL REFERENCES users(id),
      scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      scan_method TEXT NOT NULL DEFAULT 'CAMERA_QR',
      notes TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      semester_id INTEGER NOT NULL REFERENCES semesters(id),
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      payment_type TEXT NOT NULL,
      transaction_reference TEXT NOT NULL UNIQUE,
      receipt_number TEXT NOT NULL UNIQUE,
      paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      recorded_by_user_id INTEGER REFERENCES users(id)
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS financial_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference_id TEXT,
      reference_type TEXT,
      recorded_by_user_id INTEGER REFERENCES users(id),
      adjustment_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS settlement_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      semester_id INTEGER NOT NULL REFERENCES semesters(id),
      total_advance_paid REAL NOT NULL,
      total_eligible_charges REAL NOT NULL,
      net_balance REAL NOT NULL,
      settlement_status TEXT NOT NULL,
      refund_amount REAL NOT NULL DEFAULT 0,
      outstanding_amount REAL NOT NULL DEFAULT 0,
      settled_by_user_id INTEGER NOT NULL REFERENCES users(id),
      settled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      refund_payment_reference TEXT,
      remarks TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_state TEXT,
      new_state TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS hostel_rebate_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_days INTEGER NOT NULL,
      rebate_percentage INTEGER NOT NULL,
      daily_rate REAL NOT NULL,
      rebate_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reason TEXT NOT NULL,
      warden_notes TEXT,
      reviewed_by_user_id INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ALTER TABLE to add warden columns if they don't exist (idempotent migration)
  try {
    await client.execute(`ALTER TABLE hostel_rebate_requests ADD COLUMN warden_notes TEXT;`);
  } catch { /* column already exists */ }
  try {
    await client.execute(`ALTER TABLE hostel_rebate_requests ADD COLUMN reviewed_by_user_id INTEGER REFERENCES users(id);`);
  } catch { /* column already exists */ }
  try {
    await client.execute(`ALTER TABLE hostel_rebate_requests ADD COLUMN reviewed_at TEXT;`);
  } catch { /* column already exists */ }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS semester_advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id),
      semester_label TEXT NOT NULL DEFAULT 'current',
      allocated_amount REAL NOT NULL DEFAULT 25000,
      notes TEXT,
      allocated_by_user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Indexes for high concurrency & 5,000+ student scale
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_students_qr_token ON students(qr_token);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_entitlements_lookup ON entitlements(student_id, applicable_date, meal_slot, status);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_ledger_student ON financial_ledger(student_id, created_at);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_mess_sel_student_month ON monthly_mess_selections(student_id, month_year);`);
}

export { client };
