-- =====================================================================
-- INSTALAÇÃO COMPLETA DO BANCO — cole TUDO no SQL Editor do Supabase e clique em Run.
-- Pode rodar mais de uma vez: tudo é idempotente.
-- Gerado a partir de supabase/migrations/*.sql (em ordem).
-- =====================================================================

-- >>> migrations/20261106000000_init.sql
-- =====================================================================
-- Kanban colaborativo — esquema inicial
-- Projetos → quadros → colunas → cards, com papéis por projeto,
-- convites, cota de imagens e eventos em tempo real.
--
-- Toda a autorização é aplicada no banco (RLS + funções SECURITY DEFINER
-- que verificam o papel do usuário). A aplicação nunca confia no cliente.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.project_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Configuração de produto (ajustável sem mexer no restante do SQL)
-- ---------------------------------------------------------------------

-- Validação pendente nº 10: matriz de permissões de integrantes comuns.
-- Decisão inicial: integrantes criam/editam/movem/excluem cards e anexam
-- imagens; colunas e quadros são geridos por dono/administradores.
-- Para permitir que integrantes gerenciem colunas, troque para "true".
create or replace function public.perm_members_manage_columns()
returns boolean language sql immutable as $$ select false $$;

-- Prazo para restaurar projeto arquivado (decisão confirmada: 30 dias).
create or replace function public.archive_restore_window()
returns interval language sql immutable as $$ select interval '30 days' $$;

-- Limites de imagens (decisões confirmadas).
create or replace function public.image_max_bytes()
returns bigint language sql immutable as $$ select 10::bigint * 1024 * 1024 $$;
create or replace function public.images_per_card()
returns int language sql immutable as $$ select 3 $$;
create or replace function public.project_quota_bytes()
returns bigint language sql immutable as $$ select 1000::bigint * 1024 * 1024 $$;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  name        text not null default '' check (char_length(name) <= 80),
  avatar_url  text check (avatar_url is null or char_length(avatar_url) <= 500),
  locale      text not null default 'pt-BR' check (locale in ('pt-BR', 'en')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  description  text not null default '' check (char_length(description) <= 2000),
  -- sem "on delete cascade": impede excluir a conta de quem ainda é dono
  owner_id     uuid not null references public.profiles (id),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.project_role not null default 'member',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);
create unique index if not exists project_members_one_owner
  on public.project_members (project_id) where role = 'owner';
create index if not exists project_members_user on public.project_members (user_id);

create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  email        text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role         public.project_role not null default 'member' check (role in ('admin', 'member')),
  token        uuid not null unique default gen_random_uuid(),
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles (id) on delete set null,
  canceled_at  timestamptz
);
create unique index if not exists invitations_one_pending
  on public.invitations (project_id, email) where accepted_at is null and canceled_at is null;

create table if not exists public.boards (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  description  text not null default '' check (char_length(description) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists boards_project on public.boards (project_id);

create table if not exists public.board_columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  position    double precision not null default 0,
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists board_columns_board on public.board_columns (board_id, position);

create table if not exists public.cards (
  id                uuid primary key default gen_random_uuid(),
  board_id          uuid not null references public.boards (id) on delete cascade,
  project_id        uuid not null references public.projects (id) on delete cascade,
  -- "restrict": uma coluna só some depois que seus cards forem movidos
  column_id         uuid not null references public.board_columns (id) on delete restrict,
  title             text not null check (char_length(btrim(title)) between 1 and 200),
  description       text not null default '' check (char_length(description) <= 20000),
  description_text  text not null default '',
  assignee_id       uuid references public.profiles (id) on delete set null,
  due_date          date,
  position          double precision not null default 0,
  version           integer not null default 1,
  created_by        uuid references public.profiles (id) on delete set null,
  updated_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists cards_column on public.cards (column_id, position);
create index if not exists cards_board on public.cards (board_id);
create index if not exists cards_project on public.cards (project_id);
create index if not exists cards_assignee on public.cards (assignee_id);

create table if not exists public.card_images (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.cards (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  path        text not null unique,
  mime        text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes  bigint not null check (size_bytes > 0),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists card_images_card on public.card_images (card_id);
create index if not exists card_images_project on public.card_images (project_id);

-- ---------------------------------------------------------------------
-- Funções auxiliares de autorização
-- ---------------------------------------------------------------------
create or replace function public.is_verified()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;

create or replace function public.my_role(p_project uuid)
returns public.project_role language sql stable security definer set search_path = public as $$
  select m.role from public.project_members m
  where m.project_id = p_project and m.user_id = auth.uid() and m.active
$$;

create or replace function public.is_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role(p_project) is not null
$$;

create or replace function public.is_admin(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role(p_project) in ('owner', 'admin'), false)
$$;

create or replace function public.is_owner(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role(p_project) = 'owner', false)
$$;

create or replace function public.is_active_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = p_project and archived_at is null)
$$;

-- pode alterar cards (qualquer integrante ativo, projeto não arquivado)
create or replace function public.can_write(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member(p_project) and public.is_active_project(p_project)
$$;

-- pode administrar conteúdo (dono/admin, projeto não arquivado)
create or replace function public.can_admin(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(p_project) and public.is_active_project(p_project)
$$;

create or replace function public.can_manage_columns(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_admin(p_project)
      or (public.perm_members_manage_columns() and public.can_write(p_project))
$$;

create or replace function public.shares_project_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.project_members a
    join public.project_members b on a.project_id = b.project_id
    where a.user_id = auth.uid() and a.active and b.user_id = p_user
  )
$$;

create or replace function public.raise_app(p_code text, p_detail text default null)
returns void language plpgsql as $$
begin
  -- Códigos estáveis: o front traduz pelo código, não pela mensagem.
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, '');
end $$;

-- ---------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
drop trigger if exists boards_touch on public.boards;
create trigger boards_touch before update on public.boards
  for each row execute function public.touch_updated_at();
drop trigger if exists columns_touch on public.board_columns;
create trigger columns_touch before update on public.board_columns
  for each row execute function public.touch_updated_at();

-- Cria o perfil quando a conta é cadastrada (Supabase Auth).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, locale)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'pt-BR' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Colunas: herdam project_id do quadro; só dono/admin marcam "concluída".
create or replace function public.board_columns_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select b.project_id into new.project_id from public.boards b where b.id = new.board_id;
  if new.project_id is null then perform public.raise_app('board_not_found'); end if;
  if tg_op = 'UPDATE' and new.board_id <> old.board_id then
    perform public.raise_app('column_board_immutable');
  end if;
  new.name := btrim(new.name);
  if auth.uid() is not null
     and (tg_op = 'INSERT' and new.is_done or tg_op = 'UPDATE' and new.is_done is distinct from old.is_done)
     and not public.is_admin(new.project_id) then
    perform public.raise_app('forbidden_done_flag');
  end if;
  return new;
end $$;

drop trigger if exists board_columns_guard on public.board_columns;
create trigger board_columns_guard before insert or update on public.board_columns
  for each row execute function public.board_columns_guard();

-- Cards: consistência quadro/coluna/projeto, responsável ativo e versão.
create or replace function public.cards_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_col_board uuid;
begin
  select b.project_id into new.project_id from public.boards b where b.id = new.board_id;
  if new.project_id is null then perform public.raise_app('board_not_found'); end if;

  if tg_op = 'UPDATE' and new.board_id <> old.board_id then
    perform public.raise_app('card_board_immutable');
  end if;

  select c.board_id into v_col_board from public.board_columns c where c.id = new.column_id;
  if v_col_board is distinct from new.board_id then
    perform public.raise_app('column_not_in_board');
  end if;

  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not exists (
       select 1 from public.project_members m
       where m.project_id = new.project_id and m.user_id = new.assignee_id and m.active
     ) then
    perform public.raise_app('assignee_not_active_member');
  end if;

  new.title := btrim(new.title);

  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- A versão só muda quando o conteúdo muda; mover não gera conflito.
    if (new.title, new.description, new.assignee_id, new.due_date)
       is distinct from (old.title, old.description, old.assignee_id, old.due_date) then
      new.version := old.version + 1;
    else
      new.version := old.version;
    end if;
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists cards_guard on public.cards;
create trigger cards_guard before insert or update on public.cards
  for each row execute function public.cards_guard();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.invitations     enable row level security;
alter table public.boards          enable row level security;
alter table public.board_columns   enable row level security;
alter table public.cards           enable row level security;
alter table public.card_images     enable row level security;

-- Privilégios por coluna: o cliente só altera o que é editável;
-- o restante passa por funções que verificam o papel.
revoke all on public.profiles, public.projects, public.project_members, public.invitations,
  public.boards, public.board_columns, public.cards, public.card_images from anon, authenticated;

grant select on public.profiles, public.projects, public.project_members, public.invitations,
  public.boards, public.board_columns, public.cards, public.card_images to authenticated;
grant update (name, avatar_url, locale) on public.profiles to authenticated;
grant update (name, description) on public.projects to authenticated;
grant update (name, description) on public.boards to authenticated;
grant insert (id, board_id, name, position, is_done) on public.board_columns to authenticated;
grant update (name, position, is_done) on public.board_columns to authenticated;
grant insert (id, board_id, column_id, title, description, description_text, assignee_id, due_date, position)
  on public.cards to authenticated;
grant update (column_id, title, description, description_text, assignee_id, due_date, position)
  on public.cards to authenticated;
grant delete on public.cards to authenticated;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_project_with(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- projects
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (public.is_member(id));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (public.can_admin(id)) with check (public.can_admin(id));

-- project_members
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members for select to authenticated
  using (public.is_member(project_id) or user_id = auth.uid());

-- invitations: só dono/admin enxergam (contêm o token)
drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
  using (public.is_admin(project_id));

-- boards
drop policy if exists boards_select on public.boards;
create policy boards_select on public.boards for select to authenticated
  using (public.is_member(project_id));
drop policy if exists boards_update on public.boards;
create policy boards_update on public.boards for update to authenticated
  using (public.can_admin(project_id)) with check (public.can_admin(project_id));

-- board_columns
drop policy if exists columns_select on public.board_columns;
create policy columns_select on public.board_columns for select to authenticated
  using (public.is_member(project_id));
drop policy if exists columns_insert on public.board_columns;
create policy columns_insert on public.board_columns for insert to authenticated
  with check (public.can_manage_columns((select b.project_id from public.boards b where b.id = board_id)));
drop policy if exists columns_update on public.board_columns;
create policy columns_update on public.board_columns for update to authenticated
  using (public.can_manage_columns(project_id)) with check (public.can_manage_columns(project_id));

-- cards
drop policy if exists cards_select on public.cards;
create policy cards_select on public.cards for select to authenticated
  using (public.is_member(project_id));
drop policy if exists cards_insert on public.cards;
create policy cards_insert on public.cards for insert to authenticated
  with check (public.can_write((select b.project_id from public.boards b where b.id = board_id)));
drop policy if exists cards_update on public.cards;
create policy cards_update on public.cards for update to authenticated
  using (public.can_write(project_id)) with check (public.can_write(project_id));
drop policy if exists cards_delete on public.cards;
create policy cards_delete on public.cards for delete to authenticated
  using (public.can_write(project_id));

-- card_images: leitura por integrantes; escrita só por funções/servidor
drop policy if exists card_images_select on public.card_images;
create policy card_images_select on public.card_images for select to authenticated
  using (public.is_member(project_id));

-- ---------------------------------------------------------------------
-- Funções (RPC) — cada uma valida o papel antes de agir
-- ---------------------------------------------------------------------

create or replace function public.create_project(p_name text, p_description text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_verified() then perform public.raise_app('not_verified'); end if;
  if char_length(btrim(coalesce(p_name, ''))) = 0 then perform public.raise_app('name_required'); end if;
  insert into public.projects (name, description, owner_id)
  values (btrim(p_name), coalesce(btrim(p_description), ''), auth.uid())
  returning id into v_id;
  insert into public.project_members (project_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

create or replace function public.archive_project(p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_project) then perform public.raise_app('forbidden'); end if;
  update public.projects set archived_at = now() where id = p_project and archived_at is null;
end $$;

-- Restaurável por 30 dias a partir do arquivamento. Nada é apagado
-- automaticamente: depois do prazo o projeto segue arquivado.
create or replace function public.restore_project(p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_archived timestamptz;
begin
  if not public.is_owner(p_project) then perform public.raise_app('forbidden'); end if;
  select archived_at into v_archived from public.projects where id = p_project for update;
  if v_archived is null then return; end if;
  if now() > v_archived + public.archive_restore_window() then
    perform public.raise_app('restore_window_expired');
  end if;
  update public.projects set archived_at = null where id = p_project;
end $$;

-- Exclusão definitiva: só o dono, só de projeto arquivado, com o nome
-- digitado como confirmação. Devolve os caminhos dos arquivos para que o
-- servidor remova o conteúdo do Storage.
create or replace function public.delete_project(p_project uuid, p_confirm_name text)
returns setof text language plpgsql security definer set search_path = public as $$
declare v_name text; v_archived timestamptz;
begin
  if not public.is_owner(p_project) then perform public.raise_app('forbidden'); end if;
  select name, archived_at into v_name, v_archived from public.projects where id = p_project for update;
  if v_archived is null then perform public.raise_app('must_archive_first'); end if;
  if btrim(coalesce(p_confirm_name, '')) <> v_name then perform public.raise_app('confirm_name_mismatch'); end if;
  return query select path from public.card_images where project_id = p_project;
  delete from public.cards where project_id = p_project;
  delete from public.projects where id = p_project;
end $$;

create or replace function public.transfer_ownership(p_project uuid, p_new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_admin(p_project) or not public.is_owner(p_project) then
    perform public.raise_app('forbidden');
  end if;
  if p_new_owner = auth.uid() then return; end if;
  if not exists (select 1 from public.project_members
                 where project_id = p_project and user_id = p_new_owner and active) then
    perform public.raise_app('target_not_active_member');
  end if;
  update public.project_members set role = 'admin' where project_id = p_project and user_id = auth.uid();
  update public.project_members set role = 'owner' where project_id = p_project and user_id = p_new_owner;
  update public.projects set owner_id = p_new_owner where id = p_project;
end $$;

create or replace function public.set_member_role(p_project uuid, p_user uuid, p_role public.project_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_project) or not public.is_active_project(p_project) then
    perform public.raise_app('forbidden');
  end if;
  if p_role = 'owner' then perform public.raise_app('use_transfer_ownership'); end if;
  if p_user = auth.uid() then perform public.raise_app('cannot_change_owner'); end if;
  update public.project_members set role = p_role
  where project_id = p_project and user_id = p_user and role <> 'owner';
end $$;

-- Dono gere qualquer pessoa (exceto a si mesmo); admin gere integrantes comuns.
create or replace function public.can_manage_member(p_project uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_admin(p_project)
     and p_user <> auth.uid()
     and exists (
       select 1 from public.project_members t
       where t.project_id = p_project and t.user_id = p_user
         and t.role <> 'owner'
         and (t.role = 'member' or public.is_owner(p_project))
     )
$$;

create or replace function public.set_member_active(p_project uuid, p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_member(p_project, p_user) then perform public.raise_app('forbidden'); end if;
  update public.project_members set active = p_active where project_id = p_project and user_id = p_user;
end $$;

-- p_mode: null (só verifica), 'unassign' ou 'reassign' (com p_reassign_to)
create or replace function public.remove_member(
  p_project uuid, p_user uuid, p_mode text default null, p_reassign_to uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.can_manage_member(p_project, p_user) then perform public.raise_app('forbidden'); end if;
  select count(*) into v_count from public.cards where project_id = p_project and assignee_id = p_user;
  if v_count > 0 then
    if p_mode is null then
      perform public.raise_app('member_has_cards', v_count::text);
    elsif p_mode = 'reassign' then
      if p_reassign_to is null or p_reassign_to = p_user or not exists (
        select 1 from public.project_members
        where project_id = p_project and user_id = p_reassign_to and active) then
        perform public.raise_app('target_not_active_member');
      end if;
      update public.cards set assignee_id = p_reassign_to
      where project_id = p_project and assignee_id = p_user;
    elsif p_mode = 'unassign' then
      update public.cards set assignee_id = null where project_id = p_project and assignee_id = p_user;
    else
      perform public.raise_app('invalid_mode');
    end if;
  end if;
  delete from public.project_members where project_id = p_project and user_id = p_user;
end $$;

create or replace function public.leave_project(p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_owner(p_project) then perform public.raise_app('owner_cannot_leave'); end if;
  update public.cards set assignee_id = null where project_id = p_project and assignee_id = auth.uid();
  delete from public.project_members where project_id = p_project and user_id = auth.uid();
end $$;

-- Convites: válidos por 7 dias; reenviar gera novo token e novo prazo.
create or replace function public.create_invitation(p_project uuid, p_email text, p_role public.project_role default 'member')
returns public.invitations language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(p_email)); v_inv public.invitations;
begin
  if not public.can_admin(p_project) then perform public.raise_app('forbidden'); end if;
  if p_role = 'owner' then perform public.raise_app('forbidden'); end if;
  if p_role = 'admin' and not public.is_owner(p_project) then perform public.raise_app('only_owner_invites_admin'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then perform public.raise_app('invalid_email'); end if;
  if exists (select 1 from public.project_members m join public.profiles p on p.id = m.user_id
             where m.project_id = p_project and p.email = v_email) then
    perform public.raise_app('already_member');
  end if;

  update public.invitations
     set token = gen_random_uuid(), expires_at = now() + interval '7 days',
         role = p_role, invited_by = auth.uid(), created_at = now()
   where project_id = p_project and email = v_email and accepted_at is null and canceled_at is null
  returning * into v_inv;

  if v_inv.id is null then
    insert into public.invitations (project_id, email, role, invited_by)
    values (p_project, v_email, p_role, auth.uid())
    returning * into v_inv;
  end if;
  return v_inv;
end $$;

create or replace function public.resend_invitation(p_invitation uuid)
returns public.invitations language plpgsql security definer set search_path = public as $$
declare v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_invitation;
  if v_inv.id is null or not public.can_admin(v_inv.project_id) then perform public.raise_app('forbidden'); end if;
  if v_inv.accepted_at is not null or v_inv.canceled_at is not null then perform public.raise_app('invitation_closed'); end if;
  update public.invitations set token = gen_random_uuid(), expires_at = now() + interval '7 days'
  where id = p_invitation returning * into v_inv;
  return v_inv;
end $$;

create or replace function public.cancel_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
  select project_id into v_project from public.invitations where id = p_invitation;
  if v_project is null or not public.can_admin(v_project) then perform public.raise_app('forbidden'); end if;
  update public.invitations set canceled_at = now()
  where id = p_invitation and accepted_at is null and canceled_at is null;
end $$;

-- Dados mínimos para a página do convite (quem tem o token).
create or replace function public.get_invitation(p_token uuid)
returns table (project_name text, inviter_name text, email text, role public.project_role, status text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select pr.name, coalesce(p.name, ''), i.email, i.role,
         case
           when i.canceled_at is not null then 'canceled'
           when i.accepted_at is not null then 'accepted'
           when i.expires_at < now() then 'expired'
           when pr.archived_at is not null then 'archived'
           else 'pending'
         end,
         i.expires_at
  from public.invitations i
  join public.projects pr on pr.id = i.project_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token
$$;

-- Acesso só começa com conta verificada + e-mail igual ao convidado.
create or replace function public.accept_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_inv public.invitations; v_email text;
begin
  if auth.uid() is null or not public.is_verified() then perform public.raise_app('not_verified'); end if;
  select * into v_inv from public.invitations where token = p_token for update;
  if v_inv.id is null then perform public.raise_app('invitation_not_found'); end if;
  if v_inv.canceled_at is not null then perform public.raise_app('invitation_canceled'); end if;
  if v_inv.accepted_at is not null then
    if v_inv.accepted_by = auth.uid() then return v_inv.project_id; end if;
    perform public.raise_app('invitation_closed');
  end if;
  if v_inv.expires_at < now() then perform public.raise_app('invitation_expired'); end if;
  if not public.is_active_project(v_inv.project_id) then perform public.raise_app('project_archived'); end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from v_inv.email then perform public.raise_app('invitation_email_mismatch'); end if;

  insert into public.project_members (project_id, user_id, role)
  values (v_inv.project_id, auth.uid(), v_inv.role)
  on conflict (project_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = v_inv.id;
  return v_inv.project_id;
end $$;

-- Quadro novo já com colunas sugeridas (editáveis).
create or replace function public.create_board(p_project uuid, p_name text, p_description text, p_columns text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_i int := 0; v_done_idx int;
begin
  if not public.can_admin(p_project) then perform public.raise_app('forbidden'); end if;
  if char_length(btrim(coalesce(p_name, ''))) = 0 then perform public.raise_app('name_required'); end if;
  insert into public.boards (project_id, name, description)
  values (p_project, btrim(p_name), coalesce(btrim(p_description), ''))
  returning id into v_id;
  v_done_idx := coalesce(array_length(p_columns, 1), 0);
  foreach v_name in array coalesce(p_columns, '{}'::text[]) loop
    v_i := v_i + 1;
    if char_length(btrim(v_name)) > 0 then
      -- a última coluna sugerida começa marcada como "concluída"
      insert into public.board_columns (board_id, name, position, is_done)
      values (v_id, btrim(v_name), v_i * 1024, v_i = v_done_idx and v_done_idx >= 3);
    end if;
  end loop;
  return v_id;
end $$;

create or replace function public.delete_board(p_board uuid, p_confirm_name text)
returns setof text language plpgsql security definer set search_path = public as $$
declare v_project uuid; v_name text;
begin
  select project_id, name into v_project, v_name from public.boards where id = p_board;
  if v_project is null or not public.can_admin(v_project) then perform public.raise_app('forbidden'); end if;
  if btrim(coalesce(p_confirm_name, '')) <> v_name then perform public.raise_app('confirm_name_mismatch'); end if;
  return query select ci.path from public.card_images ci join public.cards c on c.id = ci.card_id where c.board_id = p_board;
  delete from public.cards where board_id = p_board;
  delete from public.boards where id = p_board;
end $$;

-- Remove coluna; se tiver cards, move-os (ordem relativa preservada)
-- para o destino na mesma transação. Qualquer falha desfaz tudo.
create or replace function public.delete_column(p_column uuid, p_target uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_col public.board_columns; v_count int; v_base double precision;
begin
  select * into v_col from public.board_columns where id = p_column for update;
  if v_col.id is null or not public.can_manage_columns(v_col.project_id) then perform public.raise_app('forbidden'); end if;
  select count(*) into v_count from public.cards where column_id = p_column;
  if v_count > 0 then
    if p_target is null then perform public.raise_app('column_has_cards', v_count::text); end if;
    if p_target = p_column or not exists (
      select 1 from public.board_columns where id = p_target and board_id = v_col.board_id) then
      perform public.raise_app('invalid_target_column');
    end if;
    select coalesce(max(position), 0) into v_base from public.cards where column_id = p_target;
    update public.cards c set column_id = p_target, position = v_base + s.rn * 1024
    from (select id, row_number() over (order by position, created_at) as rn
          from public.cards where column_id = p_column) s
    where c.id = s.id;
  end if;
  delete from public.board_columns where id = p_column;
end $$;

-- Cota de imagens -----------------------------------------------------
create or replace function public.project_storage_used(p_project uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select case when public.is_member(p_project)
    then coalesce((select sum(size_bytes) from public.card_images where project_id = p_project), 0)
    else 0 end
$$;

-- Verificação prévia (antes do upload) — devolve o motivo do bloqueio.
create or replace function public.check_image_upload(p_card uuid, p_size bigint, p_mime text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_project uuid; v_count int; v_used bigint;
begin
  select project_id into v_project from public.cards where id = p_card;
  if v_project is null or not public.can_write(v_project) then return 'forbidden'; end if;
  if p_mime not in ('image/jpeg', 'image/png', 'image/webp') then return 'invalid_type'; end if;
  if p_size > public.image_max_bytes() then return 'file_too_large'; end if;
  select count(*) into v_count from public.card_images where card_id = p_card;
  if v_count >= public.images_per_card() then return 'card_image_limit'; end if;
  select coalesce(sum(size_bytes), 0) into v_used from public.card_images where project_id = v_project;
  if v_used + p_size > public.project_quota_bytes() then return 'project_quota_exceeded'; end if;
  return 'ok';
end $$;

-- Registro após o upload; trava o projeto para evitar corrida na cota.
create or replace function public.register_card_image(p_card uuid, p_path text, p_size bigint, p_mime text)
returns public.card_images language plpgsql security definer set search_path = public as $$
declare v_project uuid; v_reason text; v_img public.card_images;
begin
  select project_id into v_project from public.cards where id = p_card;
  if v_project is null then perform public.raise_app('forbidden'); end if;
  perform pg_advisory_xact_lock(hashtext(v_project::text));
  v_reason := public.check_image_upload(p_card, p_size, p_mime);
  if v_reason <> 'ok' then perform public.raise_app(v_reason); end if;
  if p_path not like v_project::text || '/' || p_card::text || '/%' then perform public.raise_app('invalid_path'); end if;
  insert into public.card_images (card_id, project_id, path, mime, size_bytes, created_by)
  values (p_card, v_project, p_path, p_mime, p_size, auth.uid())
  returning * into v_img;
  return v_img;
end $$;

create or replace function public.delete_card_image(p_image uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_img public.card_images;
begin
  select * into v_img from public.card_images where id = p_image;
  if v_img.id is null or not public.can_write(v_img.project_id) then perform public.raise_app('forbidden'); end if;
  delete from public.card_images where id = p_image;
  return v_img.path;
end $$;

-- Exclusão de conta: bloqueada enquanto a pessoa for dona de projetos.
-- (Validação pendente nº 7: fluxo definitivo de transferência/encerramento.)
create or replace function public.owned_projects()
returns table (id uuid, name text) language sql stable security definer set search_path = public as $$
  select id, name from public.projects where owner_id = auth.uid() order by name
$$;

-- Permissões de execução ------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.get_invitation(uuid) to anon;

-- ---------------------------------------------------------------------
-- Tempo real (o Supabase aplica as políticas de SELECT a cada assinante)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.cards; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.board_columns; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.card_images; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.boards; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.project_members; exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Storage: bucket privado; só o servidor (service role) grava e gera
-- URLs assinadas depois de checar se a pessoa é integrante do projeto.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- >>> migrations/20261106010000_profiles_fix.sql
-- =====================================================================
-- Correção: contas sem perfil.
-- Quem se cadastrou antes da migração inicial (ou quando o gatilho de
-- auth.users não rodou) ficava sem linha em public.profiles. Resultado:
-- criar projeto falhava (owner_id → profiles) e salvar o perfil não
-- alterava nada. Agora o perfil é garantido em todos os pontos de entrada.
-- =====================================================================

-- 1) Cria os perfis que faltam
insert into public.profiles (id, email, name, locale)
select u.id,
       lower(u.email),
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)),
       case when u.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'pt-BR' end
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- 2) Garante o perfil da pessoa conectada (idempotente)
create or replace function public.ensure_profile()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.profiles (id, email, name, locale)
  select u.id,
         lower(u.email),
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1)),
         case when u.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'pt-BR' end
  from auth.users u
  where u.id = auth.uid() and u.email is not null
  on conflict (id) do nothing;
end $$;

-- 3) Atualização do perfil: cria se faltar e devolve a linha salva
create or replace function public.update_my_profile(p_name text, p_avatar_url text default null, p_set_avatar boolean default false)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v public.profiles;
begin
  if auth.uid() is null then perform public.raise_app('forbidden'); end if;
  if char_length(btrim(coalesce(p_name, ''))) = 0 then perform public.raise_app('name_required'); end if;
  if p_set_avatar and p_avatar_url is not null and p_avatar_url !~ '^https://' then perform public.raise_app('invalid_url'); end if;
  perform public.ensure_profile();
  update public.profiles
     set name = left(btrim(p_name), 80),
         avatar_url = case when p_set_avatar then p_avatar_url else avatar_url end
   where id = auth.uid()
  returning * into v;
  if v.id is null then perform public.raise_app('not_found'); end if;
  return v;
end $$;

-- 4) Criar projeto e aceitar convite garantem o perfil antes
create or replace function public.create_project(p_name text, p_description text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_verified() then perform public.raise_app('not_verified'); end if;
  if char_length(btrim(coalesce(p_name, ''))) = 0 then perform public.raise_app('name_required'); end if;
  perform public.ensure_profile();
  insert into public.projects (name, description, owner_id)
  values (left(btrim(p_name), 120), left(coalesce(btrim(p_description), ''), 2000), auth.uid())
  returning id into v_id;
  insert into public.project_members (project_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

create or replace function public.accept_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_inv public.invitations; v_email text;
begin
  if auth.uid() is null or not public.is_verified() then perform public.raise_app('not_verified'); end if;
  perform public.ensure_profile();
  select * into v_inv from public.invitations where token = p_token for update;
  if v_inv.id is null then perform public.raise_app('invitation_not_found'); end if;
  if v_inv.canceled_at is not null then perform public.raise_app('invitation_canceled'); end if;
  if v_inv.accepted_at is not null then
    if v_inv.accepted_by = auth.uid() then return v_inv.project_id; end if;
    perform public.raise_app('invitation_closed');
  end if;
  if v_inv.expires_at < now() then perform public.raise_app('invitation_expired'); end if;
  if not public.is_active_project(v_inv.project_id) then perform public.raise_app('project_archived'); end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from v_inv.email then perform public.raise_app('invitation_email_mismatch'); end if;
  insert into public.project_members (project_id, user_id, role)
  values (v_inv.project_id, auth.uid(), v_inv.role)
  on conflict (project_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = v_inv.id;
  return v_inv.project_id;
end $$;

revoke execute on function public.ensure_profile(), public.update_my_profile(text, text, boolean) from public, anon;
grant execute on function public.ensure_profile(), public.update_my_profile(text, text, boolean) to authenticated;

-- 5) Fotos de perfil: bucket público só para leitura; gravação apenas
--    pelo servidor (service role), depois de validar o arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Recarrega o cache da API para enxergar as funções novas
notify pgrst, 'reload schema';

-- Conferência: deve listar as funções do app
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in ('create_project','update_my_profile','ensure_profile','accept_invitation','delete_column') order by 1;
