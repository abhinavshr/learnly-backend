import { pool } from "../config/db.js";

export async function createPlan({ userId, title, examDate, hoursPerDay, days }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      "INSERT INTO `StudyPlan` (userId, title, examDate, hoursPerDay) VALUES (?, ?, ?, ?)",
      [userId, title, examDate, hoursPerDay]
    );
    const planId = result.insertId;

    const rows = days.map((d) => [
      planId,
      d.dayIndex,
      d.date,
      d.focus,
      JSON.stringify(d.tasks),
    ]);
    await conn.query(
      "INSERT INTO `StudyPlanDay` (planId, dayIndex, `date`, focus, tasks) VALUES ?",
      [rows]
    );

    await conn.commit();
    return planId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listPlansByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT sp.id, sp.title, sp.examDate, sp.hoursPerDay, sp.createdAt,
            COUNT(spd.id) AS totalDays,
            SUM(spd.isDone) AS completedDays
     FROM \`StudyPlan\` sp LEFT JOIN \`StudyPlanDay\` spd ON spd.planId = sp.id
     WHERE sp.userId = ? GROUP BY sp.id ORDER BY sp.createdAt DESC`,
    [userId]
  );
  return rows.map((r) => ({ ...r, totalDays: Number(r.totalDays), completedDays: Number(r.completedDays) }));
}

export async function findPlan(id, userId) {
  const [rows] = await pool.execute(
    "SELECT id, title, examDate, hoursPerDay, createdAt FROM `StudyPlan` WHERE id = ? AND userId = ?",
    [id, userId]
  );
  return rows[0] || null;
}

export async function getPlanDays(planId) {
  const [rows] = await pool.execute(
    "SELECT id, dayIndex, `date`, focus, tasks, isDone FROM `StudyPlanDay` WHERE planId = ? ORDER BY dayIndex",
    [planId]
  );
  return rows.map((r) => ({ ...r, isDone: Boolean(r.isDone) }));
}

export async function setDayDone(planId, dayIndex, isDone) {
  const [result] = await pool.execute(
    "UPDATE `StudyPlanDay` SET isDone = ? WHERE planId = ? AND dayIndex = ?",
    [isDone, planId, dayIndex]
  );
  return result.affectedRows > 0;
}

export async function deletePlan(id, userId) {
  const [result] = await pool.execute(
    "DELETE FROM `StudyPlan` WHERE id = ? AND userId = ?",
    [id, userId]
  );
  return result.affectedRows > 0;
}