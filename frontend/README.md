# Frontend — Sistema de Reserva de Parqueos

Next.js (App Router) + TypeScript + Tailwind. Talks to the backend via `NEXT_PUBLIC_API_URL`.

## Quick start
```bash
cp .env.example .env        # NEXT_PUBLIC_API_URL=http://localhost:8080
npm install
npm run dev                 # http://localhost:3000  → redirects to /login
```

## Layout
- `app/(auth)/login` — working login form → stores JWT via `lib/auth`.
- `app/(driver)/*` — availability, reservations (placeholders this increment).
- `app/(admin)/*` — dashboard, users, spaces, tariffs, history (placeholders).
- `lib/api.ts` — fetch wrapper + `login()`. `lib/auth.tsx` — session context.

Route groups `(auth)`/`(driver)`/`(admin)` don't affect URLs; they organize screens by audience.
Suggested next libs: TanStack Query (≤30s availability polling), React Hook Form + Zod, Recharts.
