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

notify pgrst, 'reload schema';
