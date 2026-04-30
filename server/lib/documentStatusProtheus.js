import { isSqlServer, sqlQuery } from './database.js';

let shouldUseStatusProtheusFilterPromise;

export async function shouldUseStatusProtheusFilter() {
  if (!isSqlServer) return false;

  if (!shouldUseStatusProtheusFilterPromise) {
    shouldUseStatusProtheusFilterPromise = (async () => {
      const columnResult = await sqlQuery(`
        select count(1) as total
        from DADOS_BI.sys.columns c
        join DADOS_BI.sys.objects o on o.object_id = c.object_id
        join DADOS_BI.sys.schemas s on s.schema_id = o.schema_id
        where s.name = 'dbo'
          and o.name = 'tb_qlog_documentos'
          and c.name = 'status_protheus'
      `);

      if (Number(columnResult.recordset[0]?.total || 0) === 0) {
        return false;
      }

      const valueResult = await sqlQuery(`
        select top 1 1 as has_value
        from DADOS_BI.dbo.tb_qlog_documentos
        where status_protheus is not null
          and ltrim(rtrim(convert(varchar(20), status_protheus))) <> ''
      `);

      return valueResult.recordset.length > 0;
    })();
  }

  return shouldUseStatusProtheusFilterPromise;
}
