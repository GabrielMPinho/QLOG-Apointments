import { sqlQuery } from '../lib/database.js';

const result = await sqlQuery(`
  select c.name as column_name
  from sys.columns c
  where c.object_id = object_id('dbo.tb_qlog_tipos_evento_documento')
  order by c.column_id;

  select *
  from dbo.tb_qlog_tipos_evento_documento
  order by id;

  select count(*) as total_null_events
  from dbo.tb_qlog_eventos_documento
  where status_antigo is null
    and status_novo is null;

  select count(*) as total_process_payloads
  from dbo.tb_qlog_eventos_documento
  where json_value(metadados, '$.acao') in ('processo_iniciado', 'processo_finalizado', 'processo_cancelado')
     or json_value(metadados, '$.evento') in ('APONTAMENTO_INICIADO', 'APONTAMENTO_FINALIZADO', 'APONTAMENTO_CANCELADO');

  select top 20
    id,
    documento_id,
    apontamento_id,
    tipo_evento_id,
    status_antigo,
    status_novo,
    data_hora_evento,
    metadados
  from dbo.tb_qlog_eventos_documento
  where documento_id = 9374
  order by data_hora_evento asc, id asc;

  with latest as (
    select
      documento_id,
      status_novo,
      row_number() over (
        partition by documento_id
        order by data_hora_evento desc, id desc
      ) as rn
    from dbo.tb_qlog_eventos_documento
    where status_novo is not null
  )
  select top 20
    d.id as documento_id,
    d.numero_documento,
    d.status as status_documento,
    latest.status_novo as ultimo_status_evento
  from DADOS_BI.dbo.tb_qlog_documentos d
  join latest on latest.documento_id = d.id
    and latest.rn = 1
  where isnull(convert(varchar(100), d.status), '') <> latest.status_novo
  order by d.id desc;

  select top 20
    a.id as apontamento_id,
    a.documento_id,
    d.numero_documento,
    d.status as status_documento,
    latest.status_novo as ultimo_status_evento,
    latest.status_antigo
  from DADOS_BI.dbo.tb_qlog_apontamentos a
  join DADOS_BI.dbo.tb_qlog_documentos d on d.id = a.documento_id
  outer apply (
    select top 1
      e.status_antigo,
      e.status_novo
    from dbo.tb_qlog_eventos_documento e
    where e.apontamento_id = a.id
      and e.status_novo is not null
    order by e.data_hora_evento desc, e.id desc
  ) latest
  where latest.status_novo = 'CANCELADO'
  order by a.atualizado desc, a.id desc;

  select top 20
    e.id,
    e.documento_id,
    d.numero_documento,
    e.apontamento_id,
    e.tipo_evento_id,
    e.status_antigo,
    e.status_novo,
    e.data_hora_evento,
    d.status as status_documento
  from dbo.tb_qlog_eventos_documento e
  left join DADOS_BI.dbo.tb_qlog_documentos d on d.id = e.documento_id
  order by e.data_hora_evento desc, e.id desc;
`);

console.log(JSON.stringify(result.recordsets, null, 2));
