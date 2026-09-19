import { pool } from "../config/db.js";

// Includes passwordHash, so use it only for login/register checks
export async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    "SELECT * FROM `User` WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

// Safe version: never returns passwordHash
export async function findUserById(id) {
  const [rows] = await pool.execute(
    "SELECT id, name, email, createdAt FROM `User` WHERE id = ?",
    [id]
  );
  return rows[0] || null;
}

export async function createUser({ name, email, passwordHash }) {
  const [result] = await pool.execute(
    "INSERT INTO `User` (name, email, passwordHash) VALUES (?, ?, ?)",
    [name, email, passwordHash]
  );
  return result.insertId;
}