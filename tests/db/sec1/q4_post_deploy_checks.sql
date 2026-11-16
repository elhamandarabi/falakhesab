-- Q4 (read-only): run right after Step 12. Changes nothing. Every row should say ok = true.
select 'falak_choose_free body is the Step 12 version' as check,
       md5(replace(prosrc, E'\r', '')) = 'dd5deef7bce29b49f4b1db4323a73b7f' as ok
from pg_proc where oid = 'public.falak_choose_free(uuid)'::regprocedure
union all
select 'falak_request_plan body is the Step 12 version',
       md5(replace(prosrc, E'\r', '')) = '4106df4ae4d383204d2ed51524c948a5'
from pg_proc where oid = 'public.falak_request_plan(uuid, text)'::regprocedure
union all
select 'both still SECURITY DEFINER with search_path=public',
       bool_and(prosecdef and proconfig = array['search_path=public'])
from pg_proc where oid in ('public.falak_choose_free(uuid)'::regprocedure, 'public.falak_request_plan(uuid, text)'::regprocedure)
union all
select 'signed-in users can still execute both (owners need them)',
       bool_and(has_function_privilege('authenticated', oid, 'EXECUTE'))
from pg_proc where oid in ('public.falak_choose_free(uuid)'::regprocedure, 'public.falak_request_plan(uuid, text)'::regprocedure)
union all
select 'Step 11 billing is not installed, or is installed with mode off',
       to_regclass('public.billing_config') is null
       or coalesce((select (xpath('/row/m/text()', query_to_xml('select value->>''mode'' as m from public.billing_config where id = 1', false, false, '')))[1]::text), 'off') = 'off';
-- Also compare by eye: run Q1 again; the acl column must be exactly what it was before Step 12.
