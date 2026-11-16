# Falak Hesab

Online double-entry accounting for small businesses and travel agencies, in English, Dari, Pashto and Turkish.
Live at [falakhesab.com](https://falakhesab.com). Made by Falak Travel, Istanbul.

## Stack
- Browser app: plain JavaScript (`js/`), page and styles in `shell.html`, translations in `i18n/dict.txt`
- Database, sign-in, files: Supabase (PostgreSQL with row-level security), setup in `database/`
- Help chatbot: Supabase Edge Function (`chatbot/`, `supabase/functions/falak-chat/`)
- Hosting: Netlify (static files)

## Build
1. Put your Supabase URL and anon (public) key in a local copy of `build.sh`, or copy `config/config.example.js` to `site/config.js`.
2. Run `bash build.sh`. The website is written to `site/`.
3. Upload the `site/` folder to Netlify.

Never commit real keys. The service-role key and the Anthropic key are kept only as Supabase secrets.

## Database
Run `database/supabase-setup.sql` once in the Supabase SQL Editor (safe to run again). Single steps and their undo files are in `database/`.
`step11-bank-payments.sql` (bank-transfer billing) is not switched on. `step12-sec1-fix.sql` is waiting for review.

## Tests
Browser tests (Playwright) and database tests (local PostgreSQL) are in `tests/`. See `PACKAGE-NOTES.txt`.
