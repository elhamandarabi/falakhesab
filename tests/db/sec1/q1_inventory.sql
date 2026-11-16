-- Q1 (read-only): are the 5 SEC-1 functions installed, and how?
-- Supabase → SQL Editor → paste → Run. Changes nothing.
with wanted(name) as (values ('falak_choose_free'),('falak_request_plan'),('falak_billing_create'),('falak_billing_report'),('falak_billing_cancel'))
select w.name,
       p.oid is not null                                           as installed,
       p.oid::regprocedure                                         as signature,
       p.prosecdef                                                 as security_definer,
       p.proconfig                                                 as settings,          -- expect {search_path=public}
       pg_get_userbyid(p.proowner)                                 as owner,
       p.proacl                                                    as acl,               -- raw grants
       case when p.oid is null then null else has_function_privilege('anon', p.oid, 'EXECUTE') end          as anon_can_execute,
       case when p.oid is null then null else has_function_privilege('authenticated', p.oid, 'EXECUTE') end as authenticated_can_execute,
       md5(replace(p.prosrc, E'\r', ''))                           as body_md5,
       pg_get_functiondef(p.oid)                                   as definition
from wanted w
left join pg_proc p on p.proname = w.name and p.pronamespace = 'public'::regnamespace
order by w.name;
