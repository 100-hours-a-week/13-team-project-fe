# 13-team-project-fe

Frontend starter using React + TypeScript + Vite with Feature-Sliced Design
(FSD).

## Requirements

- Node.js 18+ (or 20+)

## Getting Started

```bash
npm install
npm run dev
```

## Environment

- `VITE_API_BASE_URL` (optional): API base URL (e.g. `http://localhost:8080`). Defaults to same origin.
- `VITE_API_PROXY_TARGET` (optional, dev): Vite dev proxy target for `/api` (default `http://localhost:8080`).

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

## Structure

```
src/
  app/
  pages/
  widgets/
  features/
  entities/
  shared/
```

## Aliases

- `@/` maps to `src/`.
