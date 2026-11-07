-- REVERSE COMPETITIVO: executar depois de schema.sql e ETAPA-2-ONLINE.sql.
-- Não apaga salas, gravações ou o modo local existentes.
create table if not exists public.reverse_competitions (
 room_id uuid primary key references public.rooms(id) on delete cascade,
 round_no integer not null default 0,
 total_rounds integer not null default 0,
 phase text not null default 'creator' check (phase in ('creator','attempts','vote','reveal','finished')),
 updated_at timestamptz not null default now()
);
create table if not exists public.reverse_competitive_audios (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.rooms(id) on delete cascade,
 round_no integer not null,
 user_id uuid not null references auth.users(id),
 is_creator boolean not null,
 normal_path text not null,
 reversed_path text not null,
 peaks_normal jsonb not null,
 peaks_reversed jsonb not null,
 duration double precision not null,
 created_at timestamptz not null default now(),
 unique(room_id,round_no,user_id)
);
create table if not exists public.reverse_competitive_votes (
 room_id uuid not null references public.rooms(id) on delete cascade,
 round_no integer not null,
 voter_id uuid not null references auth.users(id),
 audio_id uuid not null references public.reverse_competitive_audios(id),
 primary key(room_id,round_no,voter_id)
);
create table if not exists public.reverse_competitive_scores (
 room_id uuid not null references public.rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 points integer not null default 0,
 primary key(room_id,user_id)
);
alter table public.reverse_competitions enable row level security;
alter table public.reverse_competitive_audios enable row level security;
alter table public.reverse_competitive_votes enable row level security;
alter table public.reverse_competitive_scores enable row level security;
drop policy if exists 'competitive game members' on public.reverse_competitions;
create policy 'competitive game members' on public.reverse_competitions for select to authenticated using(public.is_room_member(room_id));
drop policy if exists 'competitive audio members' on public.reverse_competitive_audios;
create policy 'competitive audio members' on public.reverse_competitive_audios for select to authenticated using(public.is_room_member(room_id));
drop policy if exists 'competitive votes after reveal' on public.reverse_competitive_votes;
create policy 'competitive votes after reveal' on public.reverse_competitive_votes for select to authenticated using(
 voter_id=auth.uid() or (public.is_room_member(room_id) and exists(select 1 from public.reverse_competitions c where c.room_id=reverse_competitive_votes.room_id and c.round_no=reverse_competitive_votes.round_no and c.phase in ('reveal','finished')))
);
drop policy if exists 'competitive scores members' on public.reverse_competitive_scores;
create policy 'competitive scores members' on public.reverse_competitive_scores for select to authenticated using(public.is_room_member(room_id));
grant select on public.reverse_competitions,public.reverse_competitive_audios,public.reverse_competitive_votes,public.reverse_competitive_scores to authenticated;

-- Usar caminhos c/<sala>/<rodada>/<usuario>/normal.wav e reversed.wav.
-- Bucket privado; URLs nunca são públicas. Políticas de leitura restritas à sala.
drop policy if exists 'competitive upload' on storage.objects;
create policy 'competitive upload' on storage.objects for insert to authenticated with check (
 bucket_id='reverse-audio' and split_part(name,'/',1)='c'
 and split_part(name,'/',4)=auth.uid()::text
 and split_part(name,'/',5) in ('normal.wav','reversed.wav')
 and exists (select 1 from public.reverse_competitions c
  where c.room_id::text=split_part(name,'/',2)
  and c.round_no::text=split_part(name,'/',3)
  and c.phase in ('creator','attempts')
  and public.is_room_member(c.room_id)
  and not exists(select 1 from public.reverse_competitive_audios a where a.room_id=c.room_id and a.round_no=c.round_no and a.user_id=auth.uid())
  and ((c.phase='creator' and auth.uid()=(select p.user_id from public.room_players p where p.room_id=c.room_id order by p.joined_at,p.id offset (c.round_no % (select count(*) from public.room_players x where x.room_id=c.room_id)) limit 1))
  or (c.phase='attempts' and auth.uid()<>(select p.user_id from public.room_players p where p.room_id=c.room_id order by p.joined_at,p.id offset (c.round_no % (select count(*) from public.room_players x where x.room_id=c.room_id)) limit 1))))
 );
drop policy if exists 'competitive download' on storage.objects;
create policy 'competitive download' on storage.objects for select to authenticated using (
 bucket_id='reverse-audio' and split_part(name,'/',1)='c'
 and exists (select 1 from public.reverse_competitions c where c.room_id::text=split_part(name,'/',2)
 and public.is_room_member(c.room_id) and
 (split_part(name,'/',4)=auth.uid()::text or
 (c.round_no::text=split_part(name,'/',3) and (
  (c.phase='attempts' and split_part(name,'/',5)='reversed.wav' and exists(select 1 from public.reverse_competitive_audios a where a.room_id=c.room_id and a.round_no=c.round_no and a.is_creator and a.user_id::text=split_part(name,'/',4)))
  or (c.phase='vote' and split_part(name,'/',5)='normal.wav' and exists(select 1 from public.reverse_competitive_audios a where a.room_id=c.room_id and a.round_no=c.round_no and not a.is_creator and a.user_id::text=split_part(name,'/',4)))
  or c.phase in ('reveal','finished')
 ))))
);

create or replace function public.reverse_competitive_initialize(p_room uuid) returns void
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if not exists(select 1 from public.rooms where id=p_room and host_user_id=auth.uid() and status='playing') then raise exception 'Somente o anfitrião de uma sala iniciada.'; end if;
 select count(*) into n from public.room_players where room_id=p_room;
 if n<2 then raise exception 'São necessários pelo menos dois jogadores.'; end if;
 insert into public.reverse_competitions(room_id,total_rounds) values(p_room,n)
 on conflict(room_id) do nothing;
 insert into public.reverse_competitive_scores(room_id,user_id)
 select p_room,user_id from public.room_players where room_id=p_room on conflict do nothing;
end $$;

create or replace function public.reverse_competitive_submit(
 p_room uuid,p_round integer,p_normal text,p_reversed text,
 p_peaks_normal jsonb,p_peaks_reversed jsonb,p_duration double precision
) returns void language plpgsql security definer set search_path=public,storage as $$
declare g public.reverse_competitions%rowtype; creator uuid; n integer; cnt integer;
begin
 select * into g from public.reverse_competitions where room_id=p_room for update;
 if not found or g.round_no<>p_round or g.phase not in ('creator','attempts') then raise exception 'Rodada indisponível.'; end if;
 select count(*) into n from public.room_players where room_id=p_room;
 select user_id into creator from public.room_players where room_id=p_room order by joined_at,id offset (p_round % n) limit 1;
 if not public.is_room_member(p_room) or (g.phase='creator' and auth.uid()<>creator) or (g.phase='attempts' and auth.uid()=creator) then raise exception 'Não é sua vez.'; end if;
 if p_duration<=0 or p_duration>21 or jsonb_typeof(p_peaks_normal)<>'array' or jsonb_typeof(p_peaks_reversed)<>'array' then raise exception 'Áudio inválido.'; end if;
 if p_normal<>'c/'||p_room||'/'||p_round||'/'||auth.uid()||'/normal.wav' or p_reversed<>'c/'||p_room||'/'||p_round||'/'||auth.uid()||'/reversed.wav' then raise exception 'Caminho inválido.'; end if;
 if not exists(select 1 from storage.objects where bucket_id='reverse-audio' and name=p_normal)
 or not exists(select 1 from storage.objects where bucket_id='reverse-audio' and name=p_reversed) then raise exception 'Áudios ainda não enviados.'; end if;
 insert into public.reverse_competitive_audios(room_id,round_no,user_id,is_creator,normal_path,reversed_path,peaks_normal,peaks_reversed,duration)
 values(p_room,p_round,auth.uid(),auth.uid()=creator,p_normal,p_reversed,p_peaks_normal,p_peaks_reversed,p_duration);
 if g.phase='creator' then
  update public.reverse_competitions set phase='attempts',updated_at=now() where room_id=p_room;
 else
  select count(*) into cnt from public.reverse_competitive_audios where room_id=p_room and round_no=p_round and not is_creator;
  if cnt>=n-1 then update public.reverse_competitions set phase=case when n=2 then 'reveal' else 'vote' end,updated_at=now() where room_id=p_room;
   if n=2 then
    update public.reverse_competitive_scores set points=points+50 where room_id=p_room and user_id=creator;
    update public.reverse_competitive_scores set points=points+150 where room_id=p_room and user_id<>creator;
   end if;
  end if;
 end if;
end $$;

create or replace function public.reverse_competitive_vote(p_room uuid,p_round integer,p_audio uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g public.reverse_competitions%rowtype; n integer; cnt integer; creator uuid;
begin
 select * into g from public.reverse_competitions where room_id=p_room for update;
 if not found or g.round_no<>p_round or g.phase<>'vote' or not public.is_room_member(p_room) then raise exception 'Votação encerrada.'; end if;
 if not exists(select 1 from public.reverse_competitive_audios where id=p_audio and room_id=p_room and round_no=p_round and not is_creator and user_id<>auth.uid()) then raise exception 'Voto inválido.'; end if;
 insert into public.reverse_competitive_votes(room_id,round_no,voter_id,audio_id) values(p_room,p_round,auth.uid(),p_audio);
 select count(*) into n from public.room_players where room_id=p_room;
 select count(*) into cnt from public.reverse_competitive_votes where room_id=p_room and round_no=p_round;
 if cnt=n then
  update public.reverse_competitive_scores s set points=points+100*coalesce((select count(*) from public.reverse_competitive_votes v join public.reverse_competitive_audios a on a.id=v.audio_id where v.room_id=p_room and v.round_no=p_round and a.user_id=s.user_id),0)
  where s.room_id=p_room;
  update public.reverse_competitive_scores s set points=points+150 where s.room_id=p_room and s.user_id in (
   select a.user_id from public.reverse_competitive_audios a left join public.reverse_competitive_votes v on v.audio_id=a.id
   where a.room_id=p_room and a.round_no=p_round and not a.is_creator group by a.id having count(v.audio_id)=(
    select max(votes) from (select count(v2.audio_id) votes from public.reverse_competitive_audios a2 left join public.reverse_competitive_votes v2 on v2.audio_id=a2.id where a2.room_id=p_room and a2.round_no=p_round and not a2.is_creator group by a2.id) t
   )
  );
  select user_id into creator from public.reverse_competitive_audios where room_id=p_room and round_no=p_round and is_creator;
  update public.reverse_competitive_scores set points=points+50 where room_id=p_room and user_id=creator;
  update public.reverse_competitions set phase='reveal',updated_at=now() where room_id=p_room;
 end if;
end $$;

create or replace function public.reverse_competitive_next(p_room uuid) returns void
language plpgsql security definer set search_path=public as $$
declare g public.reverse_competitions%rowtype;
begin
 select * into g from public.reverse_competitions where room_id=p_room for update;
 if not found or g.phase<>'reveal' or not exists(select 1 from public.rooms where id=p_room and host_user_id=auth.uid()) then raise exception 'Somente o anfitrião pode avançar.'; end if;
 if g.round_no+1>=g.total_rounds then update public.reverse_competitions set phase='finished',updated_at=now() where room_id=p_room;
 else update public.reverse_competitions set round_no=round_no+1,phase='creator',updated_at=now() where room_id=p_room; end if;
end $$;

create or replace function public.reverse_competitive_restart(p_room uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.rooms where id=p_room and host_user_id=auth.uid()) then raise exception 'Somente o anfitrião reinicia.'; end if;
 delete from public.reverse_competitive_votes where room_id=p_room;
 delete from public.reverse_competitive_audios where room_id=p_room;
 update public.reverse_competitive_scores set points=0 where room_id=p_room;
 update public.reverse_competitions set round_no=round_no+total_rounds, total_rounds=total_rounds+total_rounds, phase='creator',updated_at=now() where room_id=p_room;
end $$;
-- NOTA: revanche cria rodadas adicionais para evitar conflito com caminhos de áudio antigos.
-- O frontend calcula o criador com round_no % número de jogadores.
revoke all on function public.reverse_competitive_initialize(uuid),public.reverse_competitive_submit(uuid,integer,text,text,jsonb,jsonb,double precision),public.reverse_competitive_vote(uuid,integer,uuid),public.reverse_competitive_next(uuid),public.reverse_competitive_restart(uuid) from public;
grant execute on function public.reverse_competitive_initialize(uuid),public.reverse_competitive_submit(uuid,integer,text,text,jsonb,jsonb,double precision),public.reverse_competitive_vote(uuid,integer,uuid),public.reverse_competitive_next(uuid),public.reverse_competitive_restart(uuid) to authenticated;
do $$ begin alter publication supabase_realtime add table public.reverse_competitions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reverse_competitive_audios; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reverse_competitive_votes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reverse_competitive_scores; exception when duplicate_object then null; end $$;
