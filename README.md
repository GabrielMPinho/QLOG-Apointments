# QLOG Appointments

QLOG Appointments is a web application for tracking logistics operation appointments. The document is used as operational context, while execution state is controlled by appointments.

---

## Stack

- React, Vite, and TypeScript
- Tailwind CSS
- Node.js and Express
- SQL Server as the production database
- SQLite fallback for local development

---

## Requirements

- Node.js 22 or newer
- npm

---

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Update `.env` with your database credentials.

---

## Environment Variables

| Variable | Description |
| --- | --- |
| `PORT` | API port. Defaults to `3001`. |
| `DB_PROVIDER` | Database provider. Use `sqlserver` for SQL Server or leave unset for SQLite fallback. |
| `SQLSERVER_CONNECTION_STRING` | Optional full SQL Server connection string. |
| `SQLSERVER_HOST` | SQL Server host. |
| `SQLSERVER_PORT` | SQL Server port. Defaults to `1433`. |
| `SQLSERVER_USER` | SQL Server username. |
| `SQLSERVER_PASSWORD` | SQL Server password. |
| `SQLSERVER_DATABASE` | SQL Server database name. |
| `SQLSERVER_ENCRYPT` | Enables SQL Server encryption when set to `true`. |
| `SQLSERVER_TRUST_SERVER_CERTIFICATE` | Trusts the SQL Server certificate when set to `true`. |

---

## Development

Run the API and frontend together:

```bash
npm run dev
```

Run only the API:

```bash
npm run api
```

Run only the frontend:

```bash
npm run dev:frontend
```

Build the frontend:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

## Production Docker

Build the production image:

```bash
docker compose up --build
```

The production container serves both the Express API and the built React app on port `3001`.

> If SQL Server runs on the host machine, set `SQLSERVER_HOST=host.docker.internal` in `.env`.  
> If SQL Server is in another container or server, use that service name or network address instead.

Health check:

```bash
curl http://localhost:3001/api/health
```

---

## Project Structure

```text
Dockerfile           Production image definition
docker-compose.yml   Local production-like container runner
server/              Express API, services, repositories, and database access
src/                 React application
src/app/components/  Shared frontend components
src/app/context/     Application state
src/app/pages/       Operator and supervisor screens
src/app/services/    Frontend API client
src/styles/          Global styles and Tailwind theme
```

---

## Main Workflow

1. The user signs in.
2. The user chooses a logistics operation.
3. The API lists available documents for that operation.
4. The user starts an appointment.
5. The API prevents the same user from opening more than one appointment at a time.
6. The user finishes the appointment.
7. The API stores the finish timestamp in the appointments table.

---

## Supported Operations

- Unloading
- Checking
- Storage
- Picking
- Labeling
- Shipping

---

## Repository Hygiene

The repository intentionally excludes generated builds, dependencies, logs, local databases, and real environment files. Never commit `.env` or any file containing credentials.
