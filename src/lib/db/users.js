import { getSql, isDatabaseConfigured } from './client.js';

/**
 * @typedef {Object} DbUser
 * @property {string} id
 * @property {string} email
 * @property {string} password_hash
 * @property {string|null} name
 * @property {string} role
 * @property {string} plan
 */

/**
 * @param {string} email
 * @returns {Promise<DbUser|null>}
 */
export async function findUserByEmail(email) {
  if (!isDatabaseConfigured()) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, password_hash, name, role, plan
    FROM users
    WHERE email = ${email.trim().toLowerCase()}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * @param {string} id
 * @returns {Promise<DbUser|null>}
 */
export async function findUserById(id) {
  if (!isDatabaseConfigured()) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, password_hash, name, role, plan
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * @param {{ email: string, passwordHash: string, name?: string|null }} input
 */
export async function createUser(input) {
  const sql = getSql();
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || email.split('@')[0];
  const rows = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${input.passwordHash}, ${name})
    RETURNING id, email, name, role, plan
  `;
  return rows[0];
}
