-- REVERSE: estrutura inicial de salas multiplayer.
-- Execute este arquivo no SQL Editor do projeto Supabase.

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null check (char_length(player_name) between 2 and 20),
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists room_players_room_id_idx on public.room_players(room_id);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;

-- Função auxiliar SECURITY DEFINER evita recursão entre políticas RLS.
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

-- O usuário só pode consultar salas e participantes das salas das quais participa.
drop policy if exists "room members can read their room" on public.rooms;
create policy "room members can read their room"
on public.rooms for select to authenticated
using (public.is_room_member(id));

drop policy if exists "members can read players in their room" on public.room_players;
create policy "members can read players in their room"
on public.room_players for select to authenticated
using (public.is_room_member(room_id));

-- Cria uma sala e registra automaticamente o anfitrião.
create or replace function public.create_room(p_player_name text)
returns table(room_id uuid, room_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room_id uuid;
  v_code text;
  v_attempt integer := 0;
begin
  if auth.uid() is null then raise exception 'Você precisa entrar para criar uma sala.'; end if;
  if char_length(trim(p_player_name)) not between 2 and 20 then raise exception 'O nome deve ter entre 2 e 20 caracteres.'; end if;

  loop
    v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 6));
    begin
      insert into public.rooms(code, host_user_id) values (v_code, auth.uid()) returning id into v_room_id;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 10 then raise exception 'Não foi possível gerar um código. Tente novamente.'; end if;
    end;
  end loop;

  insert into public.room_players(room_id, user_id, player_name, is_host)
  values (v_room_id, auth.uid(), trim(p_player_name), true);
  return query select v_room_id, v_code;
end;
$$;

-- Entra em uma sala aberta, limitando-a a 8 participantes.
create or replace function public.join_room(p_room_code text, p_player_name text)
returns table(room_id uuid, room_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'Você precisa entrar para participar.'; end if;
  if char_length(trim(p_player_name)) not between 2 and 20 then raise exception 'O nome deve ter entre 2 e 20 caracteres.'; end if;

  select * into v_room from public.rooms where code = upper(trim(p_room_code)) for update;
  if not found then raise exception 'Sala não encontrada. Confira o código.'; end if;
  if v_room.status <> 'waiting' then raise exception 'Esta partida já começou.'; end if;

  if not exists (select 1 from public.room_players where room_players.room_id = v_room.id and user_id = auth.uid()) then
    if (select count(*) from public.room_players where room_players.room_id = v_room.id) >= 8 then
      raise exception 'Esta sala já está cheia.';
    end if;
    insert into public.room_players(room_id, user_id, player_name, is_host)
    values (v_room.id, auth.uid(), trim(p_player_name), false);
  end if;

  return query select v_room.id, v_room.code;
end;
$$;

-- Apenas o anfitrião pode iniciar a partida; exige pelo menos 2 jogadores.
create or replace function public.start_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Sala não encontrada.'; end if;
  if v_room.host_user_id <> auth.uid() then raise exception 'Somente o anfitrião pode iniciar.'; end if;
  if v_room.status <> 'waiting' then raise exception 'Esta sala já foi iniciada.'; end if;
  if (select count(*) from public.room_players where room_id = p_room_id) < 2 then
    raise exception 'São necessários pelo menos 2 jogadores.';
  end if;
  update public.rooms set status = 'playing' where id = p_room_id;
end;
$$;

-- Permite sair; se o anfitrião sair, a sala é encerrada e removida.
create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  select host_user_id into v_host from public.rooms where id = p_room_id for update;
  if not found then return; end if;
  if v_host = auth.uid() then
    delete from public.rooms where id = p_room_id;
  else
    delete from public.room_players where room_id = p_room_id and user_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.create_room(text) from public;
revoke all on function public.join_room(text, text) from public;
revoke all on function public.start_room(uuid) from public;
revoke all on function public.leave_room(uuid) from public;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.start_room(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

grant select on public.rooms to authenticated;
grant select on public.room_players to authenticated;

-- Habilita as duas tabelas no Realtime para atualizar o lobby em todos os celulares.
do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.room_players;
exception when duplicate_object then null;
end $$;
