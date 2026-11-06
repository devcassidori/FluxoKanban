-- Testes de autorização e regras de negócio. Rode com:
--   psql -v ON_ERROR_STOP=1 -f supabase_stub.sql -f ../migrations/*.sql -f rls_test.sql
\set QUIET on
set client_min_messages = warning;

create or replace function public.t_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
end $$;

create or replace function public.t_expect_error(p_sql text, p_code text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_code is null or sqlerrm = p_code or sqlerrm like '%' || p_code || '%' then return; end if;
    raise exception 'esperava erro %, veio: %', p_code, sqlerrm;
  end;
  raise exception 'esperava erro % em: %', p_code, p_sql;
end $$;
grant execute on function public.t_as(uuid), public.t_expect_error(text, text) to authenticated;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@ex.com',   now(), '{"name":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@ex.com', now(), '{"name":"Bruno"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carla@ex.com', now(), '{"name":"Carla"}'),
  ('00000000-0000-0000-0000-00000000000d', 'davi@ex.com',  null,  '{"name":"Davi"}');

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;

set role authenticated;

-- Dono cria projeto e quadro com colunas sugeridas
select t_as('00000000-0000-0000-0000-00000000000a');
insert into ctx select 'p', create_project('Site', 'desc');
insert into ctx select 'b', create_board((select v from ctx where k='p'), 'Sprint', '', array['A fazer','Em andamento','Concluído']);
do $$ begin
  assert (select count(*) from board_columns where board_id = (select v from ctx where k='b')) = 3, 'colunas sugeridas';
  assert (select is_done from board_columns where name = 'Concluído'), 'última coluna concluída';
end $$;
insert into ctx select 'c1', id from board_columns where name = 'A fazer';
insert into ctx select 'c2', id from board_columns where name = 'Em andamento';

-- Não verificado não cria projeto
select t_as('00000000-0000-0000-0000-00000000000d');
select t_expect_error($$select create_project('X')$$, 'not_verified');

-- Estranho não vê nada
select t_as('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from projects) = 0, 'outsider não vê projetos';
  assert (select count(*) from boards) = 0, 'outsider não vê quadros';
end $$;
select t_expect_error($$insert into cards (board_id, column_id, title) values ((select v from ctx where k='b'), (select v from ctx where k='c1'), 'x')$$, 'row-level security');

-- Convite: só para o e-mail convidado, conta verificada
select t_as('00000000-0000-0000-0000-00000000000a');
insert into ctx select 'tok', (create_invitation((select v from ctx where k='p'), 'Bruno@ex.com', 'member')).token;
select t_as('00000000-0000-0000-0000-00000000000c');
select t_expect_error($$select accept_invitation((select v from ctx where k='tok'))$$, 'invitation_email_mismatch');
select t_as('00000000-0000-0000-0000-00000000000b');
select accept_invitation((select v from ctx where k='tok'));
do $$ begin assert is_member((select v from ctx where k='p')), 'bruno virou integrante'; end $$;

-- Integrante cria card, não marca coluna como concluída nem cria quadro
insert into cards (id, board_id, column_id, title, position)
values ('00000000-0000-0000-0000-0000000000f1', (select v from ctx where k='b'), (select v from ctx where k='c1'), 'Card 1', 1024),
       ('00000000-0000-0000-0000-0000000000f2', (select v from ctx where k='b'), (select v from ctx where k='c1'), 'Card 2', 2048);
update board_columns set is_done = true where id = (select v from ctx where k='c1');
do $$ begin assert not (select is_done from board_columns where id = (select v from ctx where k='c1')), 'integrante não marca concluída'; end $$;
select t_expect_error($$select create_board((select v from ctx where k='p'), 'B2', '', '{}')$$, 'forbidden');
select t_expect_error($$update projects set owner_id = '00000000-0000-0000-0000-00000000000b'$$, 'permission denied');
select t_expect_error($$select archive_project((select v from ctx where k='p'))$$, 'forbidden');

-- Versão sobe só em mudança de conteúdo
update cards set column_id = (select v from ctx where k='c2') where id = '00000000-0000-0000-0000-0000000000f1';
do $$ begin assert (select version from cards where id = '00000000-0000-0000-0000-0000000000f1') = 1, 'mover não muda versão'; end $$;
update cards set title = 'Card 1b' where id = '00000000-0000-0000-0000-0000000000f1';
do $$ begin assert (select version from cards where id = '00000000-0000-0000-0000-0000000000f1') = 2, 'editar muda versão'; end $$;

-- Responsável precisa ser integrante ativo
select t_expect_error($$update cards set assignee_id = '00000000-0000-0000-0000-00000000000c' where id = '00000000-0000-0000-0000-0000000000f2'$$, 'assignee_not_active_member');
update cards set assignee_id = '00000000-0000-0000-0000-00000000000b' where id = '00000000-0000-0000-0000-0000000000f2';

-- Remover coluna com cards exige destino e preserva ordem
select t_as('00000000-0000-0000-0000-00000000000a');
select t_expect_error($$select delete_column((select v from ctx where k='c1'))$$, 'column_has_cards');
select delete_column((select v from ctx where k='c1'), (select v from ctx where k='c2'));
do $$ begin
  assert (select array_agg(title order by position) from cards where column_id = (select v from ctx where k='c2')) = array['Card 1b','Card 2'], 'ordem preservada';
end $$;

-- Remover integrante com cards atribuídos pede decisão; dono não pode ser removido
select t_expect_error($$select remove_member((select v from ctx where k='p'), '00000000-0000-0000-0000-00000000000b')$$, 'member_has_cards');
select t_expect_error($$select remove_member((select v from ctx where k='p'), '00000000-0000-0000-0000-00000000000a', 'unassign')$$, 'forbidden');

-- Cota de imagens
do $$ begin
  assert check_image_upload('00000000-0000-0000-0000-0000000000f2', 11 * 1024 * 1024, 'image/png') = 'file_too_large', 'limite 10MB';
  assert check_image_upload('00000000-0000-0000-0000-0000000000f2', 100, 'image/gif') = 'invalid_type', 'tipo';
end $$;
select register_card_image('00000000-0000-0000-0000-0000000000f2', (select v from ctx where k='p')::text || '/00000000-0000-0000-0000-0000000000f2/' || n || '.png', 1000, 'image/png')
from generate_series(1, 3) n;
select t_expect_error($$select register_card_image('00000000-0000-0000-0000-0000000000f2', (select v from ctx where k='p')::text || '/00000000-0000-0000-0000-0000000000f2/4.png', 1000, 'image/png')$$, 'card_image_limit');

-- Arquivar: vira somente leitura; restaurar em 30 dias; nunca auto-exclui
select archive_project((select v from ctx where k='p'));
select t_as('00000000-0000-0000-0000-00000000000b');
update cards set title = 'x' where id = '00000000-0000-0000-0000-0000000000f2';
do $$ begin assert (select title from cards where id = '00000000-0000-0000-0000-0000000000f2') = 'Card 2', 'arquivado é somente leitura'; end $$;
select t_as('00000000-0000-0000-0000-00000000000a');
select restore_project((select v from ctx where k='p'));
select archive_project((select v from ctx where k='p'));
reset role;
update projects set archived_at = now() - interval '31 days';
set role authenticated;
select t_expect_error($$select restore_project((select v from ctx where k='p'))$$, 'restore_window_expired');
do $$ begin assert (select count(*) from projects) = 1, 'projeto continua existindo'; end $$;

-- Transferência e exclusão definitiva só pelo dono
select t_as('00000000-0000-0000-0000-00000000000b');
select t_expect_error($$select delete_project((select v from ctx where k='p'), 'Site')$$, 'forbidden');
select t_as('00000000-0000-0000-0000-00000000000a');
select t_expect_error($$select delete_project((select v from ctx where k='p'), 'Errado')$$, 'confirm_name_mismatch');
do $$ begin assert (select count(*) from delete_project((select v from ctx where k='p'), 'Site')) = 3, 'devolve caminhos'; end $$;
do $$ begin assert (select count(*) from projects) = 0, 'projeto excluído'; end $$;

reset role;
\echo 'OK: todos os testes passaram'
