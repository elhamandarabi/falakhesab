-- =====================================================================
-- Falak Hesab — Step 10: help chatbot
-- Run once in Supabase → SQL Editor (project falak-io). Safe to run again.
-- Creates the chat_log table. Only the chatbot server function (service role)
-- writes to it; only the super admin can read it (Admin → Chat questions).
-- Questions are kept 90 days, then removed automatically by the function.
-- =====================================================================

create table if not exists public.chat_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid,                       -- empty for website visitors
  who         text not null default 'visitor' check (who in ('visitor','customer')),
  ip_hash     text,                       -- one-way hash, never the real IP
  lang        text,
  page        text,
  question    text not null check (char_length(question) <= 2000),
  answer      text,
  source      text not null default 'ai' check (source in ('ai','faq','limit','error')),
  tokens_in   int,
  tokens_out  int
);

create index if not exists chat_log_created_idx on public.chat_log (created_at desc);
create index if not exists chat_log_ip_idx      on public.chat_log (ip_hash, created_at desc);
create index if not exists chat_log_user_idx    on public.chat_log (user_id, created_at desc);

alter table public.chat_log enable row level security;

drop policy if exists chat_log_super_select on public.chat_log;
create policy chat_log_super_select on public.chat_log
  for select using (public.falak_is_super());

-- no insert/update/delete policies: normal users cannot write or change the log
revoke insert, update, delete on public.chat_log from anon, authenticated;

notify pgrst, 'reload schema';

-- Check: should return 1 row with rls = true
select relname, relrowsecurity as rls from pg_class where relname = 'chat_log';
