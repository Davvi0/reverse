-- Execute APÓS schema.sql. Não apague as tabelas existentes.
create table if not exists public.room_games (
 room_id uuid primary key references public.rooms(id) on delete cascade,
 turn_index integer not null default 0,
 phase text not null default 'recording' check (phase in ('recording','reveal','finished')),
 reveal_index integer not null default 0,
 updated_at timestamptz not null default now()
);
create table if not exists public.room_recordings (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.rooms(id) on delete cascade,
 turn_index integer not null,
 user_id uuid not null references auth.users(id),
 normal_path text not null,
 reversed_path text not null,
 peaks_normal jsonb not null,
 peaks_reversed jsonb not null,
 duration double precision not null,
 created_at timestamptz not null default now(),
 unique(room_id,turn_index)
);
alter table public.room_games enable row level security;
alter table public.room_recordings enable row level security;
drop policy if exists "members see game" on public.room_games;
create policy "members see game" on public.room_games for select to authenticated using (public.is_room_member(room_id));
drop policy if exists "members see recording metadata" on public.room_recordings;
create policy "members see recording metadata" on public.room_recordings for select to authenticated using (public.is_room_member(room_id));
grant select on public.room_games,public.room_recordings to authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('reverse-audio','reverse-audio',false,10485760,array['audio/wav'])
on conflict (id) do update set public=false, file_size_limit=10485760,allowed_mime_types=array['audio/wav'];
-- Caminho: room_id/turn_index/user_id/normal.wav ou reversed.wav
-- Upload permitido somente ao jogador da vez; leitura do áudio invertido após sua gravação.
drop policy if exists "reverse upload current turn" on storage.objects;
create policy "reverse upload current turn" on storage.objects for insert to authenticated
with check (bucket_id='reverse-audio' and
 exists(select 1 from public.room_games g join public.room_players p on p.room_id=g.room_id
 where g.room_id::text=split_part(name,'/',1) and g.phase='recording'
 and g.turn_index::text=split_part(name,'/',2) and p.user_id=auth.uid()
 and p.user_id::text=split_part(name,'/',3)
 and (select count(*) from public.room_players x where x.room_id=g.room_id and
 (x.joined_at,x.id)<(p.joined_at,p.id))=g.turn_index
 and split_part(name,'/',4) in ('normal.wav','reversed.wav')));
drop policy if exists "reverse read eligible audio" on storage.objects;
create policy "reverse read eligible audio" on storage.objects for select to authenticated
using (bucket_id='reverse-audio' and exists (
 select 1 from public.room_games g where g.room_id::text=split_part(name,'/',1)
 and public.is_room_member(g.room_id) and (
 g.phase in ('reveal','finished') or
 (split_part(name,'/',4)='reversed.wav' and
 split_part(name,'/',2)='0' and g.turn_index>0)
 )));
-- O banco decide a vez, impedindo avanço por outro jogador.
create or replace function public.submit_reverse_recording(
 p_room_id uuid,p_turn integer,p_normal text,p_reversed text,
 p_peaks_normal jsonb,p_peaks_reversed jsonb,p_duration double precision)
returns void language plpgsql security definer set search_path=public,storage as $$
declare g public.room_games%rowtype; v_player uuid; v_total integer;
begin
 select * into g from public.room_games where room_id=p_room_id for update;
 if not found or g.phase<>'recording' or g.turn_index<>p_turn then raise exception 'Esta vez já terminou.'; end if;
 select count(*) into v_total from public.room_players where room_id=p_room_id;
 select user_id into v_player from public.room_players where room_id=p_room_id order by joined_at,id offset p_turn limit 1;
 if v_player is distinct from auth.uid() then raise exception 'Não é sua vez.'; end if;
 if p_duration<=0 or p_duration>21 or jsonb_typeof(p_peaks_normal)<>'array' or jsonb_typeof(p_peaks_reversed)<>'array' then raise exception 'Áudio inválido.'; end if;
 if p_normal<>p_room_id::text||'/'||p_turn||'/'||auth.uid()::text||'/normal.wav' or
 p_reversed<>p_room_id::text||'/'||p_turn||'/'||auth.uid()::text||'/reversed.wav' then raise exception 'Caminho inválido.'; end if;
 if not exists(select 1 from storage.objects where bucket_id='reverse-audio' and name=p_normal) or
 not exists(select 1 from storage.objects where bucket_id='reverse-audio' and name=p_reversed) then raise exception 'Envie os dois áudios antes de avançar.'; end if;
 insert into public.room_recordings(room_id,turn_index,user_id,normal_path,reversed_path,peaks_normal,peaks_reversed,duration)
 values(p_room_id,p_turn,auth.uid(),p_normal,p_reversed,p_peaks_normal,p_peaks_reversed,p_duration);
 update public.room_games set turn_index=p_turn+1,
 phase=case when p_turn+1>=v_total then 'reveal' else 'recording' end,
 updated_at=now() where room_id=p_room_id;
end $$;
create or replace function public.advance_reverse_reveal(p_room_id uuid,p_next integer,p_finish boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare g public.room_games%rowtype; v_total integer;
begin
 select * into g from public.room_games where room_id=p_room_id for update;
 if not found or g.phase<>'reveal' then raise exception 'Revelação não disponível.'; end if;
 if not exists(select 1 from public.rooms where id=p_room_id and host_user_id=auth.uid()) then raise exception 'Só o anfitrião controla a revelação.'; end if;
 select count(*) into v_total from public.room_recordings where room_id=p_room_id;
 if p_finish then
  if g.reveal_index<>v_total-1 then raise exception 'Revele todos os áudios primeiro.'; end if;
  update public.room_games set phase='finished',updated_at=now() where room_id=p_room_id;
 else
  if p_next<0 or p_next>=v_total or abs(p_next-g.reveal_index)<>1 then raise exception 'Etapa inválida.'; end if;
  update public.room_games set reveal_index=p_next,updated_at=now() where room_id=p_room_id;
 end if;
end $$;
create or replace function public.restart_reverse_game(p_room_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.rooms where id=p_room_id and host_user_id=auth.uid()) then raise exception 'Só o anfitrião reinicia.'; end if;
 if not exists(select 1 from public.room_games where room_id=p_room_id) then raise exception 'Partida não encontrada.'; end if;
 delete from public.room_recordings where room_id=p_room_id;
 update public.room_games set turn_index=0,phase='recording',reveal_index=0,updated_at=now() where room_id=p_room_id;
end $$;
revoke all on function public.submit_reverse_recording(uuid,integer,text,text,jsonb,jsonb,double precision) from public;
revoke all on function public.advance_reverse_reveal(uuid,integer,boolean) from public;
revoke all on function public.restart_reverse_game(uuid) from public;
grant execute on function public.submit_reverse_recording(uuid,integer,text,text,jsonb,jsonb,double precision) to authenticated;
grant execute on function public.advance_reverse_reveal(uuid,integer,boolean) to authenticated;
grant execute on function public.restart_reverse_game(uuid) to authenticated;
-- Inicializa automaticamente partidas futuras e também as já iniciadas.
create or replace function public.reverse_game_on_start() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='playing' and old.status is distinct from 'playing' then
 insert into public.room_games(room_id) values(new.id) on conflict(room_id) do nothing;
 end if;
 return new;
end $$;
drop trigger if exists reverse_game_start on public.rooms;
create trigger reverse_game_start after update of status on public.rooms for each row execute function public.reverse_game_on_start();
insert into public.room_games(room_id) select id from public.rooms where status='playing' on conflict do nothing;
do $$ begin alter publication supabase_realtime add table public.room_games; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.room_recordings; exception when duplicate_object then null; end $$;
