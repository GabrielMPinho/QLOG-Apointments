# QLOG Apontamentos - Overview tecnico e proposta de banco

Este documento resume a arquitetura atual do frontend e propõe uma estrutura inicial de banco de dados para transformar o prototipo em uma aplicacao com backend real.

## 1. Visao geral do produto

O QLOG Apontamentos registra o inicio e o fim de atividades logisticas executadas por colaboradores.

Fluxos principais:

1. Login individual do colaborador.
2. Visualizacao da home operacional.
3. Inicio de uma atividade logistica.
4. Vinculo da atividade a uma NF de entrada ou pedido de venda.
5. Bloqueio de novo apontamento quando existe processo em aberto.
6. Encerramento do processo.
7. Consulta de historico e performance do usuario.

Regra central:

Um usuario nao deve ter mais de um apontamento em andamento ao mesmo tempo.

## 2. Stack atual do frontend

Stack:

- React 18.
- Vite 6.
- TypeScript.
- Tailwind CSS 4.
- React Router.
- Lucide React para icones.
- date-fns para datas.

Scripts principais:

```bash
npm run dev
npm run build
npm run preview
```

## 3. Estrutura atual do projeto

```text
src/
  main.tsx
  app/
    App.tsx
    context/
      AppContext.tsx
    data/
      mockData.ts
    pages/
      Login.tsx
      Home.tsx
      NovaOperacao.tsx
      Confirmacao.tsx
      Performance.tsx
    components/
      ThemeProvider.tsx
      ThemeToggle.tsx
      ui/
  styles/
    index.css
    tailwind.css
    theme.css
```

Responsabilidades:

- `src/main.tsx`: monta o React no elemento `#root`.
- `src/app/App.tsx`: define rotas publicas e protegidas.
- `src/app/context/AppContext.tsx`: concentra estado mockado de usuario, login, logout, processos e acoes de apontamento.
- `src/app/data/mockData.ts`: dados mockados de documentos e tipos de operacao.
- `src/app/pages/Login.tsx`: tela de login mockado.
- `src/app/pages/Home.tsx`: resumo operacional, processo em aberto, historico recente e logout.
- `src/app/pages/NovaOperacao.tsx`: selecao do tipo de operacao e documento.
- `src/app/pages/Confirmacao.tsx`: feedback apos iniciar processo.
- `src/app/pages/Performance.tsx`: indicadores e historico do usuario.

## 4. Autenticacao atual

Hoje a autenticacao e mockada no frontend.

Comportamento atual:

- Qualquer usuario e senha preenchidos fazem login.
- O usuario mockado e `Joao Silva`, matricula `MAT-2024-001`.
- O estado fica em memoria no React.
- Ao atualizar a pagina, a sessao e perdida.
- Ao sair, o estado do usuario e dos processos e zerado.
- Rotas internas sao protegidas por `ProtectedRoute`.
- A rota `/login` redireciona para `/home` se ja existir usuario logado.

No backend real:

- O login deve validar credenciais no servidor.
- A senha deve ser armazenada como hash.
- A sessao deve usar token seguro ou cookie HTTP-only.
- O frontend nao deve guardar senha.
- O logout deve invalidar sessao/token no backend, quando aplicavel.

## 5. Modelo de dominio atual

### Usuario

Campos usados no frontend:

```ts
interface User {
  id: string;
  name: string;
  matricula: string;
}
```

### Apontamento / Processo

Campos usados no frontend:

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

### Documento operacional

Campos usados no frontend:

```ts
interface Document {
  id: string;
  number: string;
  type: 'NF Entrada' | 'Pedido Venda';
  client: string;
  date: Date;
  volumes: number;
  skus: number;
}
```

## 6. Tipos de operacao

Operacoes de entrada:

- Descarga.
- Conferencia.
- Armazenagem.

Essas operacoes usam documentos do tipo `NF Entrada`.

Operacoes de saida:

- Separacao.
- Expedicao.

Essas operacoes usam documentos do tipo `Pedido Venda`.

## 7. Proposta de banco relacional

A estrutura abaixo e suficiente para um MVP com login, apontamentos, documentos, historico e performance.

### 7.1 users

Representa colaboradores que usam a aplicacao.

Campos sugeridos:

```sql
create table users (
  id uuid primary key,
  name varchar(120) not null,
  employee_number varchar(40) not null unique,
  username varchar(80) not null unique,
  password_hash varchar(255) not null,
  role_id uuid null,
  is_active boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
```

Observacoes:

- `employee_number` corresponde a matricula.
- `username` e usado no login.
- `password_hash` nunca deve ser exposto ao frontend.
- `is_active` permite bloquear usuario sem apagar historico.

### 7.2 roles

Permite separar operador, lider, supervisor e administrador.

```sql
create table roles (
  id uuid primary key,
  name varchar(60) not null unique,
  description varchar(255) null,
  created_at timestamp not null default now()
);
```

Exemplos:

- `operator`
- `leader`
- `supervisor`
- `admin`

### 7.3 operation_types

Cadastro dos tipos de operacao.

```sql
create table operation_types (
  id uuid primary key,
  code varchar(40) not null unique,
  name varchar(80) not null,
  document_kind varchar(30) not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp not null default now()
);
```

Valores iniciais:

| code | name | document_kind |
| --- | --- | --- |
| unloading | Descarga | inbound_invoice |
| checking | Conferencia | inbound_invoice |
| storage | Armazenagem | inbound_invoice |
| picking | Separacao | sales_order |
| shipping | Expedicao | sales_order |

### 7.4 partners

Representa clientes e fornecedores.

```sql
create table partners (
  id uuid primary key,
  name varchar(160) not null,
  document_number varchar(40) null,
  partner_type varchar(30) not null,
  is_active boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
```

Valores possiveis para `partner_type`:

- `customer`
- `supplier`
- `both`

### 7.5 documents

Representa NFs de entrada e pedidos de venda.

```sql
create table documents (
  id uuid primary key,
  number varchar(60) not null,
  document_kind varchar(30) not null,
  partner_id uuid not null references partners(id),
  document_date date not null,
  volumes_count integer not null default 0,
  skus_count integer not null default 0,
  status varchar(30) not null default 'available',
  external_reference varchar(120) null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (number, document_kind)
);
```

Valores possiveis para `document_kind`:

- `inbound_invoice`
- `sales_order`

Valores possiveis para `status`:

- `available`
- `in_progress`
- `completed`
- `blocked`
- `cancelled`

### 7.6 appointments

Tabela principal. Representa cada apontamento iniciado pelo usuario.

```sql
create table appointments (
  id uuid primary key,
  user_id uuid not null references users(id),
  operation_type_id uuid not null references operation_types(id),
  document_id uuid not null references documents(id),
  started_at timestamp not null,
  ended_at timestamp null,
  status varchar(30) not null,
  volumes_count integer not null default 0,
  skus_count integer not null default 0,
  cancel_reason varchar(255) null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
```

Valores possiveis para `status`:

- `in_progress`
- `completed`
- `cancelled`

Duracao:

- A duracao nao precisa ser gravada.
- Ela pode ser calculada por `ended_at - started_at`.
- Se performance precisar ser muito rapida, criar uma view materializada depois.

Regra de negocio importante:

O banco deve impedir mais de um apontamento em andamento por usuario.

No PostgreSQL, uma forma eficiente:

```sql
create unique index appointments_one_active_per_user
on appointments (user_id)
where status = 'in_progress';
```

### 7.7 appointment_events

Auditoria de eventos do apontamento.

```sql
create table appointment_events (
  id uuid primary key,
  appointment_id uuid not null references appointments(id),
  user_id uuid not null references users(id),
  event_type varchar(40) not null,
  event_at timestamp not null default now(),
  metadata jsonb null
);
```

Eventos sugeridos:

- `started`
- `completed`
- `cancelled`
- `reopened`
- `edited`

Essa tabela ajuda a responder perguntas como:

- Quem iniciou?
- Quem encerrou?
- Houve cancelamento?
- Quando um apontamento foi alterado?

### 7.8 user_sessions

Opcional, caso o backend controle sessoes.

```sql
create table user_sessions (
  id uuid primary key,
  user_id uuid not null references users(id),
  token_hash varchar(255) not null,
  created_at timestamp not null default now(),
  expires_at timestamp not null,
  revoked_at timestamp null,
  ip_address varchar(80) null,
  user_agent text null
);
```

Uso:

- Login cria sessao.
- Logout preenche `revoked_at`.
- Requisicoes validam token ativo e nao expirado.

## 8. Relacionamentos principais

```text
roles 1---N users
users 1---N appointments
operation_types 1---N appointments
partners 1---N documents
documents 1---N appointments
appointments 1---N appointment_events
users 1---N user_sessions
```

## 9. Consultas importantes

### Processo em aberto do usuario

```sql
select *
from appointments
where user_id = :user_id
  and status = 'in_progress'
limit 1;
```

### Historico recente

```sql
select a.*, ot.name as operation_name, d.number as document_number
from appointments a
join operation_types ot on ot.id = a.operation_type_id
join documents d on d.id = a.document_id
where a.user_id = :user_id
order by a.started_at desc
limit 10;
```

### Performance do dia

```sql
select
  count(*) as total_processes,
  sum(extract(epoch from (ended_at - started_at)) / 60) as total_minutes,
  avg(extract(epoch from (ended_at - started_at)) / 60) as avg_minutes,
  sum(volumes_count) as total_volumes,
  sum(skus_count) as total_skus
from appointments
where user_id = :user_id
  and started_at >= :day_start
  and started_at < :day_end
  and status = 'completed';
```

### Processos por tipo

```sql
select ot.name, count(*) as total
from appointments a
join operation_types ot on ot.id = a.operation_type_id
where a.user_id = :user_id
  and a.started_at >= :start_date
  and a.started_at < :end_date
group by ot.name
order by total desc;
```

## 10. Endpoints futuros sugeridos

Autenticacao:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Documentos:

- `GET /documents?operationTypeId=...`
- `GET /documents/:id`

Apontamentos:

- `GET /appointments/active`
- `POST /appointments/start`
- `POST /appointments/:id/end`
- `POST /appointments/:id/cancel`
- `GET /appointments/history`

Performance:

- `GET /performance/me?period=today`
- `GET /performance/me?period=week`
- `GET /performance/me/by-operation`

## 11. Regras de negocio para backend

1. Usuario precisa estar autenticado para criar apontamento.
2. Usuario inativo nao pode iniciar apontamento.
3. Usuario nao pode iniciar outro apontamento se ja tiver um em andamento.
4. Operacao de entrada so aceita documento `inbound_invoice`.
5. Operacao de saida so aceita documento `sales_order`.
6. Apontamento em andamento precisa ter `started_at` e nao deve ter `ended_at`.
7. Apontamento concluido precisa ter `started_at` e `ended_at`.
8. `ended_at` nao pode ser menor que `started_at`.
9. Cancelamento deve exigir motivo quando ja houver processo iniciado.
10. Historico nao deve ser apagado em logout.

## 12. Indices recomendados

```sql
create index appointments_user_started_at_idx
on appointments (user_id, started_at desc);

create index appointments_status_idx
on appointments (status);

create index appointments_document_idx
on appointments (document_id);

create index documents_kind_status_idx
on documents (document_kind, status);

create index documents_number_idx
on documents (number);
```

## 13. Views recomendadas

### v_user_daily_performance

Pode consolidar metricas por usuario e dia.

Campos:

- `user_id`
- `work_date`
- `total_processes`
- `completed_processes`
- `cancelled_processes`
- `total_minutes`
- `avg_minutes`
- `total_volumes`
- `total_skus`

### v_user_operation_performance

Pode consolidar metricas por usuario, periodo e tipo de operacao.

Campos:

- `user_id`
- `operation_type_id`
- `period_start`
- `period_end`
- `total_processes`
- `total_minutes`
- `total_volumes`
- `total_skus`

## 14. MVP minimo de banco

Para a primeira versao real, as tabelas indispensaveis sao:

1. `users`
2. `operation_types`
3. `partners`
4. `documents`
5. `appointments`

Tabelas recomendadas desde cedo:

1. `appointment_events`
2. `roles`
3. `user_sessions`

## 15. Como o frontend atual se conecta ao banco futuro

Mapeamento direto:

| Frontend atual | Banco futuro |
| --- | --- |
| `user` | `users` |
| `processes` | `appointments` |
| `activeProcess` | consulta em `appointments` com status `in_progress` |
| `operationTypes` | `operation_types` |
| `notasFiscaisEntrada` | `documents` com `document_kind = inbound_invoice` |
| `pedidosVenda` | `documents` com `document_kind = sales_order` |
| `startProcess()` | `POST /appointments/start` |
| `endProcess()` | `POST /appointments/:id/end` |
| `logout()` | `POST /auth/logout` + limpar estado local |

## 16. Observacoes para evolucao

Pontos que devem ser considerados antes do backend:

- Definir se documentos virao de ERP/WMS ou serao cadastrados no QLOG.
- Definir se um mesmo documento pode passar por varias operacoes em sequencia.
- Definir se varios usuarios podem trabalhar no mesmo documento ao mesmo tempo.
- Definir se encerramento exige confirmacao de volumes/SKUs reais.
- Definir se supervisores podem cancelar apontamentos de operadores.
- Definir prazo de expiracao de sessao.
- Definir relatorios por turno, equipe, setor e centro de distribuicao.

## 17. Proxima arquitetura recomendada

Camadas sugeridas:

```text
frontend React
  -> backend API
    -> service layer com regras de negocio
      -> banco relacional
```

No backend, separar:

- `AuthService`
- `UserService`
- `DocumentService`
- `AppointmentService`
- `PerformanceService`

Essa separacao evita que regras criticas fiquem no frontend, principalmente a regra de apenas um apontamento em andamento por usuario.
