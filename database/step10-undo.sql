-- Undo Step 10 (help chatbot log). Deletes the saved chat questions.
drop table if exists public.chat_log;
notify pgrst, 'reload schema';
