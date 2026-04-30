import { db, normalizeActive } from '../lib/database.js';

export function mapUser(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    name: row.name,
    username: row.username,
    matricula: row.employee_number || row.username,
    position: row.position,
    is_active: normalizeActive(row.is_active),
    created_at: row.created_at,
  };
}

export function getUserById(id) {
  return db.prepare('select * from users where id = ?').get(id);
}

export function getUserByLogin(username) {
  return db
    .prepare('select * from users where lower(username) = lower(?) or lower(name) = lower(?) limit 1')
    .get(username, username);
}

export function listUsers() {
  return db
    .prepare('select * from users order by is_active desc, name asc')
    .all()
    .map(mapUser);
}

export function createUser({ name, username, password, position }) {
  const result = db
    .prepare(`
      insert into users (name, username, password_hash, position, is_active)
      values (?, ?, ?, ?, 1)
    `)
    .run(name, username, password, position);

  return mapUser(getUserById(result.lastInsertRowid));
}

export function updateUserName(id, name) {
  db.prepare('update users set name = ?, updated_at = current_timestamp where id = ?').run(name, id);
  return mapUser(getUserById(id));
}

export function updateUserPosition(id, position) {
  db.prepare('update users set position = ?, updated_at = current_timestamp where id = ?').run(position, id);
  return mapUser(getUserById(id));
}

export function updateUser(id, { name, username, password, position, isActive }) {
  const current = getUserById(id);
  if (!current) return null;

  db
    .prepare(`
      update users
      set name = ?,
          username = ?,
          password_hash = ?,
          position = ?,
          is_active = ?,
          updated_at = current_timestamp
      where id = ?
    `)
    .run(
      name,
      username,
      password || current.password_hash,
      position,
      isActive ? 1 : 0,
      id
    );

  return mapUser(getUserById(id));
}

export function deactivateUser(id) {
  db.prepare('update users set is_active = 0, updated_at = current_timestamp where id = ?').run(id);
  return mapUser(getUserById(id));
}
