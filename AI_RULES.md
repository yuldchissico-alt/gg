# AI Rules

## Tech Stack
- **Frontend**: React 18 + TypeScript, built with Vite 5 and styled with Tailwind CSS 3 (`@tailwindcss/vite` is installed but the project pins `tailwindcss@3.4.17` — use Tailwind 3 utilities).
- **Routing**: `wouter` (NOT react-router). All routes live in `src/App.tsx`.
- **UI components**: `shadcn/ui` built on Radix UI primitives. The full Radix set is already installed — import from `@/components/ui/*`, do not edit those files, and create a new component if you need to change one.
- **Server**: Express 4 in `server/index.ts`, run via `tsx` in dev. WebSockets via `ws`. Sessions via `express-session` with `connect-pg-simple` or `memorystore`.
- **Database / ORM**: PostgreSQL on Neon (`@neondatabase/serverless`) with `drizzle-orm` and `drizzle-zod` for schema-validated types. Migrations via `drizzle-kit` (`npm run db:push`).
- **Data fetching**: `@tanstack/react-query` for server state; `axios` for HTTP.
- **Forms & validation**: `react-hook-form` + `zod` (+ `@hookform/resolvers`, `drizzle-zod`).
- **Auth**: `passport` with `passport-local` (and `openid-client` available for OIDC).
- **External integrations**: `whatsapp-web.js` / `@whiskeysockets/baileys` for WhatsApp, `node-cron` for scheduled jobs, `node-cache` + `memoizee` for in-memory caching.
- **Icons**: `lucide-react` (preferred). `react-icons` is also available when a specific brand icon is needed.
- **Misc UI libs already available**: `framer-motion`, `recharts`, `reactflow`, `react-day-picker` + `date-fns`, `cmdk`, `vaul`, `embla-carousel-react`, `react-resizable-panels`, `sonner` (toast via shadcn), `next-themes` for theme switching.

## Library Usage Rules
- **Routing**: always use `wouter` (`useLocation`, `Route`, `Switch`, `Link`). Do not add `react-router`.
- **Components**: use shadcn/ui primitives from `src/components/ui/`. Wrap or compose them in `src/components/`, do not modify the shadcn files themselves.
- **Styling**: Tailwind utility classes only. Use `clsx` + `tailwind-merge` (the `cn` helper) for conditional class merging. No CSS modules, no styled-components.
- **Icons**: prefer `lucide-react`. Reach for `react-icons` only for brand/logos not in lucide.
- **Data fetching**: server state goes through `@tanstack/react-query`. Use `axios` for the HTTP client inside query functions. Don't fetch in `useEffect` directly.
- **Forms**: build forms with `react-hook-form`. Validate with `zod` schemas, resolved via `@hookform/resolvers`. When validating DB shapes, derive schemas from Drizzle tables with `drizzle-zod`.
- **Database access**: only inside `server/` (Express routes / server-only modules). Use `drizzle-orm` with the Neon HTTP client. Never import the DB into client code.
- **Auth**: use `passport` strategies + `express-session`. Client-side auth state should be fetched via `react-query`, not stored in a global context.
- **Scheduling & caching**: use `node-cron` for recurring jobs and `node-cache` (or `memoizee` for function-level memoization) for caching — do not pull in new cache libraries.
- **WhatsApp features**: use `whatsapp-web.js` for client-style flows and `@whiskeysockets/baileys` for lower-level socket needs. Keep all WhatsApp code under `server/`.
- **Charts / graphs**: `recharts` for standard charts, `reactflow` for node/edge diagrams. Don't add `chart.js` or `d3`.
- **Dates**: `date-fns` (and `react-day-picker` for date pickers). Do not add `moment` or `dayjs`.
- **Animations**: `framer-motion` for orchestrated animation, Tailwind `transition-*` / `animate-*` classes for simple cases. `tailwindcss-animate` is available for shadcn enter/exit.
- **Type safety**: TypeScript everywhere. Shared types between client and server should live in `shared/` (or `src/types/` for client-only) and be imported, not duplicated.
- **File layout**: pages in `src/pages/`, reusable components in `src/components/`, server code in `server/`, shared code in `shared/`. Update `src/pages/Index.tsx` (and/or add a new page wired in `src/App.tsx`) so new components are actually visible.
- **Don't add new dependencies** for something an existing library already covers (see Tech Stack list above). If you think a new package is needed, justify it before installing.
