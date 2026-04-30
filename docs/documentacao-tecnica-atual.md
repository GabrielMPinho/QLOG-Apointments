# QLOG Apontamentos - Documentacao tecnica atual

Atualizado em: 2026-04-30

Este documento descreve o estado atual do projeto QLOG Apontamentos: frontend, backend, rotas, API, banco SQLite, fluxos implementados e pontos tecnicos conhecidos.

## 1. Visao geral

O QLOG Apontamentos e uma aplicacao web para registrar atividades logisticas vinculadas a documentos operacionais. O sistema permite que colaboradores iniciem e encerrem apontamentos, enquanto usuarios supervisores acompanham documentos, usuarios e indicadores operacionais.

Fluxos principais implementados:

- Login de usuario.
- Entrada inicial da aplicacao pela tela de login.
- Home operacional do separador.
- Inicio de atividade por tipo de operacao e documento disponivel.
- Bloqueio de novo apontamento quando o usuario ja possui documento em andamento.
- Encerramento de apontamento em andamento.
- Consulta de performance do usuario logado.
- Painel de supervisor com overview, usuarios, documentos e performance por usuario.
- Tema claro/escuro.

## 2. Stack

Frontend:

- React 18.
- TypeScript.
- Vite 6.
- React Router 7.
- Tailwind CSS 4.
- Lucide React para icones.
- date-fns para formatacao de datas.
- next-themes para tema.
- Componentes UI baseados em Radix/shadcn.

Backend:

- Node.js 22 ou superior.
- Express 5.
- `node:sqlite` com `DatabaseSync`.
- Banco local SQLite em `database/Qlog.db`.

Build e tooling:

- Vite para build e dev server.
- Proxy de `/api` no Vite para `http://127.0.0.1:3001`.
- `package-lock.json` como lockfile presente.

## 3. Scripts

Scripts definidos em `package.json`:

```bash
npm run dev
npm run dev:frontend
npm run api
npm run build
npm run preview
npm run start
```

Comportamento:

- `npm run dev`: inicia API e frontend via `server/dev.js`.
- `npm run dev:frontend`: inicia somente Vite em `0.0.0.0:8080`.
- `npm run api`: inicia somente a API Express.
- `npm run build`: gera build de producao em `dist/`.
- `npm run preview`: serve o build em `0.0.0.0:4173`.
- `npm run start`: alias para `npm run dev`.

Portas padrao:

- Frontend dev: `8080`.
- API: `3001`, ou `PORT` se a variavel de ambiente estiver definida.
- Preview: `4173`.

## 4. Estrutura de arquivos

Arquivos principais:

```text
src/
  main.tsx
  app/
    App.tsx
    context/
      AppContext.tsx
    services/
      api.ts
    pages/
      Login.tsx
      Home.tsx
      NovaOperacao.tsx
      Confirmacao.tsx
      Performance.tsx
      supervisor/
        SupervisorLayout.tsx
        SupervisorHome.tsx
        SupervisorUsers.tsx
        SupervisorUserPerformance.tsx
        SupervisorDocuments.tsx
        format.ts
    components/
      ThemeProvider.tsx
      ThemeToggle.tsx
      ui/
  styles/
    index.css
    globals.css
    fonts.css
    tailwind.css
    theme.css

server/
  dev.js
  index.js

database/
  Qlog.db
  Qlog.sqbpro

docs/
  overview-tecnico-banco.md
  documentacao-tecnica-atual.md
```

Responsabilidades:

- `src/main.tsx`: monta a aplicacao React no elemento `#root`.
- `src/app/App.tsx`: define providers, BrowserRouter, rotas e protecao por perfil.
- `src/app/context/AppContext.tsx`: centraliza usuario logado, processos e acoes de login/logout/inicio/fim.
- `src/app/services/api.ts`: define tipos de API, armazenamento local do usuario e wrapper `apiRequest`.
- `server/index.js`: API Express, inicializacao parcial do banco, mapeadores, middlewares e endpoints.
- `server/dev.js`: sobe API e Vite juntos em desenvolvimento.
- `vite.config.ts`: plugins React/Tailwind, alias `@` para `src` e proxy de API.

## 5. Inicializacao da aplicacao

O React e iniciado por `src/main.tsx`. A arvore principal e:

```text
React.StrictMode
  App
    ThemeProvider
      AppProvider
        BrowserRouter
          Routes
```

A entrada inicial em `/` exibe a pagina de login e limpa usuario salvo. Isso evita que a primeira abertura do sistema caia automaticamente em um usuario usado anteriormente na mesma maquina.

Ao recarregar uma rota interna, como `/home` ou `/supervisor`, o `AppProvider` restaura o usuario salvo em `localStorage`, mantendo a sessao local.

## 6. Rotas frontend

Rotas publicas:

| Rota | Tela | Observacao |
| --- | --- | --- |
| `/` | `LoginRoute` | Mostra login e executa `logout()` ao montar. |
| `/login` | `LoginRoute` | Mostra login e executa `logout()` ao montar. |

Rotas protegidas para `SEPARADOR` e `SUPERVISOR`:

| Rota | Tela |
| --- | --- |
| `/home` | `Home` |
| `/nova-operacao` | `NovaOperacao` |
| `/confirmacao` | `Confirmacao` |
| `/performance` | `Performance` |

Rotas protegidas somente para `SUPERVISOR`:

| Rota | Tela |
| --- | --- |
| `/supervisor` | `SupervisorHome` dentro de `SupervisorLayout` |
| `/supervisor/users` | `SupervisorUsers` |
| `/supervisor/users/:id/performance` | `SupervisorUserPerformance` |
| `/supervisor/documents` | `SupervisorDocuments` |

Fallback:

- Qualquer rota desconhecida redireciona para `/login`.

Protecao:

- `ProtectedRoute` redireciona usuario ausente para `/login`.
- `ProtectedRoute` redireciona perfil sem permissao para `/supervisor` ou `/home`, conforme cargo do usuario.

## 7. Autenticacao e sessao

A autenticacao atual e simples e local ao projeto.

No backend:

- `POST /api/login` procura usuario por `username` ou `name`.
- Usuario precisa estar ativo.
- A senha enviada e comparada diretamente com `password_hash`.
- Apesar do nome do campo, nao ha hash real de senha nesta versao.

No frontend:

- O usuario autenticado e salvo em `localStorage` com chave `qlog_user`.
- `apiRequest` le esse usuario salvo e envia `x-user-id` nas chamadas autenticadas.
- `logout()` limpa estado local, processos e `localStorage`.

Middlewares do backend:

- `requireUser`: exige header `x-user-id` de usuario ativo.
- `requireSupervisor`: exige usuario ativo com `position = 'SUPERVISOR'`.

Limitacao atual:

- Nao ha token, cookie seguro, expiracao de sessao ou hash de senha.
- A autorizacao depende do `x-user-id` enviado pelo cliente.

## 8. Perfis

Perfis reconhecidos:

- `SEPARADOR`: acessa fluxo operacional e performance propria.
- `SUPERVISOR`: acessa fluxo operacional e painel supervisor.

O tipo esta presente no frontend e no banco no campo `position`.

## 9. Modelo de frontend

### Usuario

Tipo principal em `src/app/services/api.ts`:

```ts
interface ApiUser {
  id: string;
  name: string;
  username: string;
  matricula?: string;
  position: 'SEPARADOR' | 'SUPERVISOR';
  is_active: boolean;
  created_at?: string;
}
```

### Documento

Tipo principal:

```ts
interface ApiDocument {
  id: string;
  origin: string;
  document_number: string;
  series: string;
  type: string;
  operation: string;
  partner_name: string;
  partner_code: string;
  partner_store: string;
  document_date: string;
  volumes: number;
  skus: number;
  gross_weight: number;
  net_weight: number;
  status: string;
  current_user_id: string | null;
  current_user_name: string | null;
  current_username: string | null;
  started_at: string | null;
  finished_at: string | null;
  last_sync_at: string | null;
  created_at: string | null;
  time_spent_minutes: number | null;
}
```

### Processo

Tipo do contexto:

```ts
interface Process {
  id: string;
  type: 'Descarga' | 'Conferencia' | 'Armazenagem' | 'Separacao' | 'Expedicao';
  documentNumber: string;
  documentType: 'NF Entrada' | 'Pedido Venda';
  client: string;
  startDate: Date;
  endDate?: Date;
  status: 'Em andamento' | 'Concluido' | 'Cancelado';
  volumes: number;
  skus: number;
  userId: string;
}
```

Observacao: no codigo ha textos com acentuacao em alguns tipos e labels; a exibicao depende da codificacao correta dos arquivos.

## 10. Telas operacionais

### Login

Arquivo: `src/app/pages/Login.tsx`.

Funcionalidades:

- Campos de usuario e senha.
- Chamada para `login(username, password)`.
- Redireciona supervisor para `/supervisor`.
- Redireciona demais usuarios para `/home`.
- Exibe erro de autenticacao.
- Possui alternador de tema.

### Home

Arquivo: `src/app/pages/Home.tsx`.

Funcionalidades:

- Exibe usuario logado e matricula.
- Mostra indicadores do dia, tempo trabalhado, em andamento e concluidos.
- Atualiza processos a cada 5 segundos.
- Mostra processo em andamento, se existir.
- Permite encerrar processo em andamento.
- Bloqueia botao de nova atividade quando ha processo ativo.
- Exibe historico recente e link para performance.
- Faz logout e redireciona para login.

### Nova Operacao

Arquivo: `src/app/pages/NovaOperacao.tsx`.

Funcionalidades:

- Lista tipos de operacao:
  - Descarga.
  - Conferencia.
  - Armazenagem.
  - Separacao.
  - Expedicao.
- Ao selecionar operacao, busca documentos disponiveis em `/api/operator/documents`.
- Permite selecionar documento e iniciar processo.
- Ao iniciar com sucesso, navega para `/confirmacao`.

### Confirmacao

Arquivo: `src/app/pages/Confirmacao.tsx`.

Funcionalidades:

- Exibe resumo do processo iniciado.
- Informa que o sistema bloqueia novo apontamento ate encerrar o atual.
- Redireciona para `/home` se nao houver processo ativo.

### Performance

Arquivo: `src/app/pages/Performance.tsx`.

Funcionalidades:

- Carrega processos do usuario logado.
- Mostra processos de hoje, semana, concluidos, tempo de hoje, tempo medio e volumes.
- Mostra processos por tipo.
- Mostra resumo de SKUs e volumes.
- Lista historico completo do usuario.

## 11. Telas de supervisor

### SupervisorLayout

Arquivo: `src/app/pages/supervisor/SupervisorLayout.tsx`.

Funcionalidades:

- Layout lateral fixo.
- Navegacao para overview, usuarios e documentos.
- Exibe usuario logado e cargo.
- Permite logout.
- Possui alternador de tema.

### SupervisorHome

Arquivo: `src/app/pages/supervisor/SupervisorHome.tsx`.

Funcionalidades:

- Busca usuarios e documentos em paralelo.
- Exibe metricas consolidadas:
  - Total de documentos.
  - Ativos.
  - Finalizados.
  - Nao iniciados.
  - Bloqueados.
  - Cancelados.
- Mostra barras por status e por operacao.
- Lista documentos em andamento.
- Lista resumo por separador.

### SupervisorUsers

Arquivo: `src/app/pages/supervisor/SupervisorUsers.tsx`.

Funcionalidades:

- Lista usuarios cadastrados.
- Cria usuario.
- Edita nome.
- Edita cargo.
- Inativa usuario.
- Acessa performance de usuarios `SEPARADOR`.

### SupervisorUserPerformance

Arquivo: `src/app/pages/supervisor/SupervisorUserPerformance.tsx`.

Funcionalidades:

- Carrega indicadores de um usuario especifico.
- Mostra dados basicos do usuario.
- Mostra documentos feitos, em andamento, cancelados, volumes, SKUs e tempo medio.
- Lista documentos vinculados ao usuario.

### SupervisorDocuments

Arquivo: `src/app/pages/supervisor/SupervisorDocuments.tsx`.

Funcionalidades:

- Lista documentos agrupados por status.
- Possui filtros por:
  - Status.
  - Operacao.
  - Origem.
  - Numero do documento.
  - Parceiro.
  - Usuario atual.
- Mostra tabela detalhada com origem, numero, serie, tipo, operacao, parceiro, volumes, SKUs, pesos, status, usuario atual e datas.

## 12. API

Base local em desenvolvimento:

```text
http://127.0.0.1:3001
```

No frontend, chamadas para `/api` sao proxadas pelo Vite.

### Publico

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/api/health` | Verifica se API esta ativa. |
| POST | `/api/login` | Autentica usuario. |

### Usuario autenticado

Requer header:

```text
x-user-id: <id do usuario>
```

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/api/me` | Retorna usuario autenticado. |
| GET | `/api/operator/processes` | Retorna processos/documentos vinculados ao usuario. |
| GET | `/api/operator/documents?operation=` | Retorna documentos disponiveis para a operacao. |
| POST | `/api/operator/documents/:id/start` | Inicia documento para o usuario. |
| POST | `/api/operator/documents/:id/end` | Encerra documento em andamento do usuario. |

### Supervisor

Requer usuario ativo com `position = 'SUPERVISOR'`.

| Metodo | Endpoint | Descricao |
| --- | --- | --- |
| GET | `/api/supervisor/dashboard` | Retorna totais consolidados. |
| GET | `/api/supervisor/users` | Lista usuarios. |
| POST | `/api/supervisor/users` | Cria usuario. |
| PUT | `/api/supervisor/users/:id/name` | Atualiza nome. |
| PUT | `/api/supervisor/users/:id/position` | Atualiza cargo. |
| DELETE | `/api/supervisor/users/:id` | Inativa usuario. |
| GET | `/api/supervisor/users/:id/performance` | Retorna performance de um usuario. |
| GET | `/api/supervisor/documents` | Lista documentos com filtros opcionais. |

Filtros aceitos em `/api/supervisor/documents`:

- `status`.
- `operation`.
- `origin`.
- `documentNumber`.
- `partner`.
- `currentUser`.

## 13. Backend

Arquivo principal: `server/index.js`.

Responsabilidades:

- Abrir `database/Qlog.db`.
- Criar tabelas minimas quando nao existem.
- Popular usuarios/documentos iniciais quando tabelas estao vazias.
- Normalizar usuarios e documentos para contratos usados pelo frontend.
- Validar autenticacao por header.
- Validar permissao de supervisor.
- Aplicar regras de negocio no inicio e encerramento de documentos.
- Registrar eventos em `document_events`.

Funcoes importantes:

- `initializeDatabaseIfNeeded()`: cria tabelas e seeds basicos quando necessario.
- `mapUser(row)`: converte linha do SQLite para `ApiUser`.
- `mapDocument(row)`: converte linha do SQLite para `ApiDocument`.
- `documentToProcess(document)`: converte documento para `Process`.
- `requireUser(req, res, next)`: middleware de autenticacao.
- `requireSupervisor(req, res, next)`: middleware de autorizacao de supervisor.
- `getAllDocuments()`: consulta documentos com usuario atual.
- `insertDocumentEvent(...)`: registra auditoria de status.

## 14. Banco de dados atual

Banco:

```text
database/Qlog.db
```

Arquivo auxiliar presente:

```text
database/Qlog.sqbpro
```

O banco atual possui as tabelas:

- `users`.
- `documents`.
- `document_events`.

### users

Schema observado no SQLite atual:

```sql
id integer primary key
name text not null
position text not null
username text not null
is_active integer not null default 1
created_at datetime not null default current_timestamp
updated_at datetime
password_hash text
```

Uso:

- Armazena usuarios do sistema.
- `position` define o perfil.
- `is_active = 0` representa usuario inativo.
- `password_hash` atualmente e comparado como texto puro no login.

### documents

Schema observado no SQLite atual:

```sql
id integer primary key
source_table text not null
external_id text
branch_code text not null
document_number text not null
document_series text
document_type text not null
document_key text
partner_code text
partner_store text
partner_name text
document_date date
operation_type_code text not null
volumes_count integer not null default 0
skus_count integer not null default 0
gross_weight real not null default 0
net_weight real not null default 0
status text not null default 'AVAILABLE'
current_user_id integer
started_at datetime
ended_at datetime
source_payload text
synced_at datetime
created_at datetime not null default current_timestamp
updated_at datetime
```

Uso:

- Representa documentos operacionais vindos de origens como `SF1` e `SC5`.
- Representa tanto documentos de entrada quanto de saida.
- Guarda usuario atual e datas de inicio/fim quando ha apontamento.
- O backend mapeia nomes alternativos para manter compatibilidade com schemas anteriores.

### document_events

Schema observado no SQLite atual:

```sql
id integer primary key
document_id integer not null
user_id integer
event_type text not null
old_status text
new_status text
event_at datetime not null default current_timestamp
metadata text
```

Uso:

- Registra eventos de mudanca operacional.
- Eventos atuais:
  - `STARTED`.
  - `COMPLETED`.
- `metadata` guarda JSON serializado.

## 15. Status de documento

Status usados atualmente:

| Status | Significado |
| --- | --- |
| `AVAILABLE` | Documento disponivel / nao iniciado. |
| `DOING` | Documento ativo / em andamento. |
| `DONE` | Documento finalizado. |
| `CANCELLED` | Documento cancelado. |
| `BLOCKED` | Documento bloqueado. |

Mapeamento para processos no frontend:

| Documento | Processo |
| --- | --- |
| `DOING` | `Em andamento` |
| `DONE` | `Concluido` |
| `CANCELLED` | `Cancelado` |

## 16. Regras de negocio implementadas

Inicio de documento:

- Usuario precisa estar autenticado.
- Usuario precisa estar ativo.
- Usuario nao pode ter outro documento com status `DOING`.
- Documento precisa existir.
- Documento precisa estar com status `AVAILABLE`.
- Ao iniciar:
  - `status` muda para `DOING`.
  - `current_user_id` recebe usuario atual.
  - `started_at` recebe timestamp atual.
  - evento `STARTED` e registrado.

Encerramento de documento:

- Usuario precisa estar autenticado.
- Documento precisa existir.
- Documento precisa estar com status `DOING`.
- Documento precisa pertencer ao usuario autenticado.
- Ao encerrar:
  - `status` muda para `DONE`.
  - `ended_at` recebe timestamp atual.
  - evento `COMPLETED` e registrado.

Supervisor:

- Apenas usuarios com `position = 'SUPERVISOR'` acessam endpoints e telas de supervisor.
- Exclusao de usuario e inativacao logica (`is_active = 0`), nao delete fisico.

## 17. Fluxo operacional resumido

```text
Login
  -> Home
    -> Nova Operacao
      -> Seleciona operacao
      -> API retorna documentos AVAILABLE da operacao
      -> Seleciona documento
      -> Inicia documento
      -> Confirmacao
    -> Home mostra documento DOING
    -> Encerrar Processo
    -> Documento vira DONE
```

## 18. Fluxo supervisor resumido

```text
Login como SUPERVISOR
  -> /supervisor
    -> Overview geral
    -> Usuarios
      -> criar / editar nome / editar cargo / inativar / ver performance
    -> Documentos
      -> filtrar e monitorar documentos por status
```

## 19. Tema e UI

Componentes relacionados:

- `ThemeProvider`.
- `ThemeToggle`.
- `src/app/components/ui/*`.

Caracteristicas:

- Suporte a modo claro e escuro.
- Uso extensivo de Tailwind.
- Uso de Lucide para icones.
- Componentes UI reutilizaveis gerados no padrao shadcn/Radix.

## 20. Build

O build de producao gera arquivos em:

```text
dist/
```

O Vite usa:

- `@vitejs/plugin-react`.
- `@tailwindcss/vite`.
- Alias `@` para `src`.
- Proxy de `/api` apenas durante desenvolvimento.

## 21. Pontos tecnicos conhecidos

Autenticacao:

- Senha nao esta hasheada de fato.
- Nao existe token ou cookie HTTP-only.
- `x-user-id` vindo do cliente e suficiente para autenticar chamadas.

Banco:

- O servidor tenta criar tabelas quando nao existem, mas o schema observado no banco atual possui colunas diferentes das tabelas criadas pelo fallback em `initializeDatabaseIfNeeded()`.
- O backend compensa parte disso com mapeadores que aceitam nomes alternativos.
- Nao ha migrations versionadas.

Modelo:

- Documento e apontamento estao unificados na tabela `documents`.
- Eventos existem em `document_events`, mas ainda nao ha tela dedicada de auditoria.
- Cancelamento existe como status, mas nao ha endpoint operacional para cancelar documento.

Frontend:

- A sessao local fica em `localStorage`.
- Recarregar uma rota interna restaura usuario salvo.
- Entrar por `/` ou `/login` limpa usuario salvo e mostra login.

Qualidade:

- Nao ha suite automatizada de testes configurada.
- Nao ha validacao com zod/yup ou contrato compartilhado entre frontend e backend.
- Ha dependencias UI instaladas que nao necessariamente estao todas em uso.

## 22. Proximos passos recomendados

Prioridade tecnica:

1. Criar migrations versionadas para SQLite.
2. Unificar nomes de colunas do schema usado pelo servidor e do banco atual.
3. Implementar hash de senha.
4. Trocar autenticacao por sessao/token seguro.
5. Criar endpoint de cancelamento com registro de motivo.
6. Criar testes para regras de inicio/fim de documento.
7. Criar uma camada de service no backend para separar regras de negocio dos endpoints.
8. Padronizar textos e codificacao dos arquivos para evitar problemas de acentuacao.

