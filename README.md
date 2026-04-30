# QLOG Apontamentos

Sistema web para apontamentos de operacoes logisticas. O documento e apenas referencia operacional; a execucao do processo e controlada por apontamentos.

## Stack

- Frontend: React, Vite e TypeScript
- UI: Tailwind CSS e componentes locais
- Backend: Node.js e Express
- Banco principal: SQL Server, database `DADOS_BI`
- Banco local: SQLite apenas como fallback/desenvolvimento local

## Estrutura

```text
Qlog/
  src/                  Frontend React
  server/               API Express, services e repositories
  server/controllers/   Rotas HTTP
  server/services/      Regras de negocio
  server/repositories/  Persistencia SQL Server/SQLite
  server/lib/           Conexao com banco e utilitarios
  docs/                 Documentacao tecnica
  dist/                 Build gerado pelo Vite
```

## Configuracao

Crie um arquivo `.env` na raiz do projeto. O arquivo real nao deve ser versionado.

Variaveis usadas:

```env
PORT=3001
DB_PROVIDER=sqlserver
SQLSERVER_HOST=
SQLSERVER_PORT=1433
SQLSERVER_USER=
SQLSERVER_PASSWORD=
SQLSERVER_DATABASE=DADOS_BI
SQLSERVER_ENCRYPT=false
SQLSERVER_TRUST_SERVER_CERTIFICATE=true
```

Tambem e possivel usar `SQLSERVER_CONNECTION_STRING` se preferir centralizar a conexao em uma unica string.

## Banco De Dados

A aplicacao consulta e grava no SQL Server `DADOS_BI`.

Tabelas principais:

- `DADOS_BI.dbo.tb_qlog_usuarios`
- `DADOS_BI.dbo.tb_qlog_documentos`
- `DADOS_BI.dbo.tb_qlog_apontamentos`
- `DADOS_BI.dbo.tb_qlog_eventos_documento`

Regras atuais:

- Documento nao possui estado operacional da execucao.
- Documento nao usa `tipo_operacao_id`.
- Operacao pertence ao apontamento.
- Um usuario pode ter apenas um apontamento aberto.
- Varios usuarios podem trabalhar no mesmo documento ao mesmo tempo.
- Ao finalizar um apontamento, a operacao finalizada deixa de aparecer para aquele documento.
- A tabela `tb_qlog_documentos` nao e alterada ao iniciar ou encerrar apontamentos.

## Operacoes

Operacoes suportadas:

- Descarga
- Conferencia
- Armazenagem
- Separacao
- Etiquetagem
- Expedicao

Busca de documentos:

- NF: `tabela_origem = SF1`, `status = DISPONIVEL`
- PV: `tabela_origem = SC5`, `status = DISPONIVEL`
- Quando `status_protheus` existir e estiver preenchido:
  - Separacao usa `05`
  - Etiquetagem e Expedicao usam `04`

## Desenvolvimento

Instale as dependencias:

```bash
npm install
```

Rode frontend e API juntos:

```bash
npm run dev
```

Scripts uteis:

```bash
npm run api
npm run dev:frontend
npm run build
```

## Fluxo Principal

1. Usuario faz login.
2. Usuario escolhe uma operacao.
3. API lista documentos disponiveis para a operacao.
4. Usuario inicia um apontamento.
5. API bloqueia novo apontamento se o usuario ja tiver um processo aberto.
6. Usuario encerra o apontamento.
7. API grava `data_hora_fim` em `tb_qlog_apontamentos`.

## Supervisor

O supervisor pode:

- Gerenciar usuarios.
- Editar dados de usuario.
- Delegar um separador a um documento e operacao.
- Consultar apontamentos, historico e performance.

## Observacoes

- Nao versionar `.env`, logs, `dist`, `node_modules` ou bancos locais.
- Reinicie `npm run dev` apos alteracoes no backend; a API nao usa hot reload.
