-- Conta sem perfil (cadastrada antes da migração) consegue criar projeto e salvar perfil.
\set QUIET on
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000e1', 'eva@ex.com', now(), '{}');
delete from public.profiles where id = '00000000-0000-0000-0000-0000000000e1';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select create_project('Projeto da Eva');
do $$ begin assert (select count(*) from projects) >= 1, 'criou projeto'; end $$;
select (update_my_profile('Eva Souza', 'https://exemplo.com/a.png', true)).name;
do $$ begin assert (select name from profiles where id = auth.uid()) = 'Eva Souza', 'perfil salvo'; end $$;
select (update_my_profile('Eva S.')).avatar_url;
do $$ begin assert (select avatar_url from profiles where id = auth.uid()) = 'https://exemplo.com/a.png', 'avatar mantido'; end $$;
reset role;
\echo 'OK: perfis'
