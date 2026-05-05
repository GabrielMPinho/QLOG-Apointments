import { syncSqlServerDocumentEventTypes } from '../repositories/apontamentosRepository.js';
import { sqlQuery } from '../lib/database.js';

await syncSqlServerDocumentEventTypes();

const result = await sqlQuery(`
  delete from dbo.tb_qlog_eventos_documento
  where status_antigo is null
    and status_novo is null;

  update dbo.tb_qlog_eventos_documento
  set status_antigo = 'INICIADO'
  where status_antigo in ('INDISPONIVEL', 'FAZENDO')
    and status_novo in ('FINALIZADO', 'CANCELADO');

  update dbo.tb_qlog_eventos_documento
  set status_novo = 'INICIADO'
  where status_novo = 'FAZENDO';

  update dbo.tb_qlog_eventos_documento
  set status_antigo = 'INICIADO'
  where status_antigo = 'FAZENDO';

  update dbo.tb_qlog_eventos_documento
  set tipo_evento_id = case status_novo
    when 'DISPONIVEL' then 1
    when 'INICIADO' then 2
    when 'CANCELADO' then 3
    when 'FINALIZADO' then 4
    else tipo_evento_id
  end
  where status_novo in ('DISPONIVEL', 'INICIADO', 'CANCELADO', 'FINALIZADO');

  update dbo.tb_qlog_eventos_documento
  set metadados = case
    when isjson(metadados) = 1 then
      json_modify(json_modify(metadados, '$.acao', 'status_alterado'), '$.evento', 'STATUS_ALTERADO')
    else N'{"acao":"status_alterado","evento":"STATUS_ALTERADO"}'
  end
  where metadados is null
    or isjson(metadados) = 0
    or json_value(metadados, '$.acao') in ('processo_iniciado', 'processo_finalizado', 'processo_cancelado')
    or json_value(metadados, '$.evento') in ('APONTAMENTO_INICIADO', 'APONTAMENTO_FINALIZADO', 'APONTAMENTO_CANCELADO');

  with ordered_events as (
    select
      id,
      lag(status_novo) over (
        partition by documento_id
        order by data_hora_evento asc, id asc
      ) as previous_status_novo
    from dbo.tb_qlog_eventos_documento
    where status_novo is not null
  )
  update event
  set event.status_antigo = ordered_events.previous_status_novo
  from dbo.tb_qlog_eventos_documento event
  join ordered_events on ordered_events.id = event.id
  where ordered_events.previous_status_novo is not null
    and (
      event.status_antigo is null
      or event.status_antigo <> ordered_events.previous_status_novo
    );

  with latest as (
    select
      documento_id,
      status_novo,
      row_number() over (
        partition by documento_id
        order by data_hora_evento desc, id desc
      ) as rn
    from dbo.tb_qlog_eventos_documento
    where status_novo in ('DISPONIVEL', 'INICIADO', 'CANCELADO', 'FINALIZADO')
  )
  update d
  set d.status = latest.status_novo,
      d.atualizado = getdate()
  from DADOS_BI.dbo.tb_qlog_documentos d
  join latest on latest.documento_id = d.id
    and latest.rn = 1
  where isnull(convert(varchar(100), d.status), '') <> latest.status_novo;
`);

console.log(JSON.stringify({ rowsAffected: result.rowsAffected }));
