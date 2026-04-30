import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databasePath = path.resolve(__dirname, '../../database/Qlog.db');

export const db = new DatabaseSync(databasePath);

export function tableExists(tableName) {
  return Boolean(
    db
      .prepare("select name from sqlite_master where type = 'table' and name = ?")
      .get(tableName)
  );
}

export function getTableColumns(tableName) {
  return db.prepare(`pragma table_info(${tableName})`).all();
}

export function hasColumn(tableName, columnName) {
  return getTableColumns(tableName).some((column) => column.name === columnName);
}

export function normalizeActive(value) {
  return value === true || Number(value) === 1;
}

