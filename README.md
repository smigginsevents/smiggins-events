# Smiggins Events

Tuesday Trivia Night & Monday Night Pool Comp — smiggins.events

## Local development

```bash
npm install
npm run dev
# → http://localhost:3000
```

Before first run, fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Supabase setup (one-time)

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New Query**, paste and run `supabase/migrations/001_initial.sql`
3. Go to **Database → Replication** and enable Realtime on the `trivia_live_state` table
4. Go to **Storage** → create a bucket called `trivia-media` (public, 10MB max)
5. Go to **Authentication → Users → Add user** — create your host account (email + password)
6. Copy your project URL + keys from **Settings → API** into `.env.local`

## Deploy to Vercel

1. Push this repo to GitHub
2. Import at [vercel.com/new](https://vercel.com/new) — it auto-detects Next.js
3. Add these environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy
5. Go to **Vercel project → Settings → Domains → Add domain → `smiggins.events`**
6. Vercel shows you the DNS records — add them in your domain registrar

## Running a trivia night

1. Open `/host` on your laptop and log in
2. Create a new Trivia Night → build questions (or import CSV)
3. Add tonight's teams
4. Run the pre-show checklist → click **Start Event**
5. In a new browser window, open `/host/trivia/[id]/display` → drag to the big screen → go fullscreen
6. Use `/host/trivia/[id]/control` on your laptop to run the show

## Sound effects

Drop MP3 files in `public/sounds/` — see `public/sounds/README.md` for details.
All sounds are optional; missing files are silently skipped.

## Routes

| Route | Description |
|---|---|
| `/` | Public homepage |
| `/trivia` | Public trivia leaderboard (Tonight / All-Time) |
| `/pool` | Public pool comp leaderboard (This Week / All-Time) |
| `/host/login` | Host login |
| `/host` | Dashboard |
| `/host/trivia/new` | Create trivia night |
| `/host/trivia/[id]/questions` | Question builder + CSV import |
| `/host/trivia/[id]/teams` | Add/manage tonight's teams |
| `/host/trivia/[id]/run` | Pre-show checklist |
| `/host/trivia/[id]/control` | Live control panel |
| `/host/trivia/[id]/display` | Big-screen show (open on external display) |
| `/host/pool/new` | Create pool comp night |
| `/host/pool/[id]/scores` | Score entry |
| `/host/teams` | Team registry |
