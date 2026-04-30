import 'dotenv/config';
import sql from 'mssql';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databasePath = path.resolve(__dirname, '../../database/Qlog.db');
const provider = String(process.env.DB_PROVIDER || 'sqlite').toLowerCase();

export const isSqlServer = provider === 'sqlserver';
export const databaseName = process.env.SQLSERVER_DATABASE || 'DADOS_BI';
export const db = isSqlServer
  ? null
  : new (await import('node:sqlite')).DatabaseSync(databasePath);

let sqlPoolPromise;

function booleanEnv(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'sim'].includes(String(value).toLowerCase());
}

export function getSqlServerConfig() {
  if (process.env.SQLSERVER_CONNECTION_STRING) {
    return process.env.SQLSERVER_CONNECTION_STRING;
  }

  return {
    server: process.env.SQLSERVER_HOST,
    port: Number(process.env.SQLSERVER_PORT || 1433),
    user: process.env.SQLSERVER_USER,
    password: process.env.SQLSERVER_PASSWORD,
    database: databaseName,
    options: {
      encrypt: booleanEnv(process.env.SQLSERVER_ENCRYPT, false),
      trustServerCertificate: booleanEnv(process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE, true),
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

export function getSqlPool() {
  if (!sqlPoolPromise) {
    sqlPoolPromise = sql.connect(getSqlServerConfig());
  }

  return sqlPoolPromise;
}

export async function sqlQuery(query, parameters = {}) {
  const pool = await getSqlPool();
  const request = pool.request();

  for (const [name, parameter] of Object.entries(parameters)) {
    if (parameter && typeof parameter === 'object' && 'type' in parameter) {
      request.input(name, parameter.type, parameter.value);
    } else {
      request.input(name, parameter);
    }
  }

  return request.query(query);
}

export { sql };

export function tableExists(tableName) {
  if (isSqlServer) return false;

  return Boolean(
    db
      .prepare("select name from sqlite_master where type = 'table' and name = ?")
      .get(tableName)
  );
}

export function getTableColumns(tableName) {
  if (isSqlServer) return [];
  return db.prepare(`pragma table_info(${tableName})`).all();
}

export function hasColumn(tableName, columnName) {
  return getTableColumns(tableName).some((column) => column.name === columnName);
}

export function normalizeActive(value) {
  return value === true || Number(value) === 1;
}

