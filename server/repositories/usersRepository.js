import { db, isSqlServer, normalizeActive, sql, sqlQuery } from '../lib/database.js';
import { hashPassword } from '../lib/passwords.js';

function positionFromTypeId(typeId) {
  return Number(typeId) === 2 ? 'SUPERVISOR' : 'SEPARADOR';
}

function typeIdFromPosition(position) {
  return String(position).toUpperCase() === 'SUPERVISOR' ? 2 : 1;
}

export function mapUser(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    name: row.name || row.nome,
    username: row.username || row.login,
    matricula: row.employee_number || row.username || row.login,
    position: row.position || positionFromTypeId(row.tipo_usuario_id),
    is_active: normalizeActive(row.is_active ?? row.ativo),
    created_at: row.created_at || row.criado,
  };
}

export async function getUserById(id) {
  if (isSqlServer) {
    const result = await sqlQuery(
      `
        select top 1
          id,
          nome,
          tipo_usuario_id,
          login,
          senha_hash,
          ativo,
          convert(varchar(19), criado, 126) as criado,
          convert(varchar(19), atualizado, 126) as atualizado
        from dbo.tb_qlog_usuarios
        where id = @id
      `,
      { id: { type: sql.Int, value: Number(id) } }
    );

    return result.recordset[0] || null;
  }

  return db.prepare('select * from users where id = ?').get(id);
}

export async function getUserByLogin(username) {
  if (isSqlServer) {
    const result = await sqlQuery(
      `
        select top 1
          id,
          nome,
          tipo_usuario_id,
          login,
          senha_hash,
          ativo,
          convert(varchar(19), criado, 126) as criado,
          convert(varchar(19), atualizado, 126) as atualizado
        from dbo.tb_qlog_usuarios
        where lower(login) = lower(@username)
           or lower(nome) = lower(@username)
      `,
      { username: { type: sql.NVarChar(255), value: username } }
    );

    return result.recordset[0] || null;
  }

  return db
    .prepare('select * from users where lower(username) = lower(?) or lower(name) = lower(?) limit 1')
    .get(username, username);
}

export async function listUsers() {
  if (isSqlServer) {
    const result = await sqlQuery(`
      select
        id,
        nome,
        tipo_usuario_id,
        login,
        senha_hash,
        ativo,
        convert(varchar(19), criado, 126) as criado,
        convert(varchar(19), atualizado, 126) as atualizado
      from dbo.tb_qlog_usuarios
      order by ativo desc, nome asc
    `);

    return result.recordset.map(mapUser);
  }

  return db
    .prepare('select * from users order by is_active desc, name asc')
    .all()
    .map(mapUser);
}

export async function createUser({ name, username, password, position }) {
  const passwordHash = hashPassword(password);

  if (isSqlServer) {
    const result = await sqlQuery(
      `
        insert into dbo.tb_qlog_usuarios (nome, tipo_usuario_id, login, senha_hash, ativo, criado, atualizado)
        output inserted.*
        values (@name, @typeId, @username, @password, 1, getdate(), null)
      `,
      {
        name: { type: sql.NVarChar(255), value: name },
        typeId: { type: sql.Int, value: typeIdFromPosition(position) },
        username: { type: sql.NVarChar(255), value: username },
        password: { type: sql.NVarChar(255), value: passwordHash },
      }
    );

    return mapUser(result.recordset[0]);
  }

  const result = db
    .prepare(`
      insert into users (name, username, password_hash, position, is_active)
      values (?, ?, ?, ?, 1)
    `)
    .run(name, username, passwordHash, position);

  return mapUser(await getUserById(result.lastInsertRowid));
}

export async function updateUserName(id, name) {
  if (isSqlServer) {
    await sqlQuery(
      `
        update dbo.tb_qlog_usuarios
        set nome = @name,
            atualizado = getdate()
        where id = @id
      `,
      {
        id: { type: sql.Int, value: Number(id) },
        name: { type: sql.NVarChar(255), value: name },
      }
    );

    return mapUser(await getUserById(id));
  }

  db.prepare('update users set name = ?, updated_at = current_timestamp where id = ?').run(name, id);
  return mapUser(await getUserById(id));
}

export async function updateUserPosition(id, position) {
  if (isSqlServer) {
    await sqlQuery(
      `
        update dbo.tb_qlog_usuarios
        set tipo_usuario_id = @typeId,
            atualizado = getdate()
        where id = @id
      `,
      {
        id: { type: sql.Int, value: Number(id) },
        typeId: { type: sql.Int, value: typeIdFromPosition(position) },
      }
    );

    return mapUser(await getUserById(id));
  }

  db.prepare('update users set position = ?, updated_at = current_timestamp where id = ?').run(position, id);
  return mapUser(await getUserById(id));
}

export async function updateUser(id, { name, username, password, position }) {
  const current = await getUserById(id);
  if (!current) return null;
  const currentPasswordHash = current.senha_hash || current.password_hash;
  const nextPasswordHash = password ? hashPassword(password) : currentPasswordHash;

  if (isSqlServer) {
    await sqlQuery(
      `
        update dbo.tb_qlog_usuarios
        set nome = @name,
            login = @username,
            senha_hash = @password,
            tipo_usuario_id = @typeId,
            atualizado = getdate()
        where id = @id
      `,
      {
        id: { type: sql.Int, value: Number(id) },
        name: { type: sql.NVarChar(255), value: name },
        username: { type: sql.NVarChar(255), value: username },
        password: { type: sql.NVarChar(255), value: nextPasswordHash },
        typeId: { type: sql.Int, value: typeIdFromPosition(position) },
      }
    );

    return mapUser(await getUserById(id));
  }

  db
    .prepare(`
      update users
      set name = ?,
          username = ?,
          password_hash = ?,
          position = ?,
          updated_at = current_timestamp
      where id = ?
    `)
    .run(
      name,
      username,
      nextPasswordHash,
      position,
      id
    );

  return mapUser(await getUserById(id));
}

export async function updateUserPasswordHash(id, passwordHash) {
  if (isSqlServer) {
    await sqlQuery(
      `
        update dbo.tb_qlog_usuarios
        set senha_hash = @passwordHash,
            atualizado = getdate()
        where id = @id
      `,
      {
        id: { type: sql.Int, value: Number(id) },
        passwordHash: { type: sql.NVarChar(255), value: passwordHash },
      }
    );

    return;
  }

  db
    .prepare('update users set password_hash = ?, updated_at = current_timestamp where id = ?')
    .run(passwordHash, id);
}

export async function deleteUser(id) {
  if (isSqlServer) {
    const result = await sqlQuery(
      `
        delete from dbo.tb_qlog_usuarios
        output deleted.*
        where id = @id
      `,
      { id: { type: sql.Int, value: Number(id) } }
    );

    return mapUser(result.recordset[0]);
  }

  const user = await getUserById(id);
  if (!user) return null;
  db.prepare('delete from users where id = ?').run(id);
  return mapUser(user);
}
