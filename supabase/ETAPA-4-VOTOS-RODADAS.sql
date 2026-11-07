-- REVERSE ETAPA 4: executar DEPOIS da ETAPA-3-COMPETITIVO-CORRIGIDO.sql.
-- Não remove salas nem gravações. Partidas em andamento devem ser reiniciadas.

alter table public.reverse_competitions
 add column if not exists start_round integer not null default 0;

alter table public.reverse_competitive_votes add column if not exists rating integer;

-- Remove as RPCs antigas: elimina a premiação automática em partidas de duas pessoas.
drop function if exists public.reverse_competitive_initialize(uuid);
drop function if exists public.reverse_competitive_vote(uuid, integer, uuid);
drop function if exists public.reverse_competitive_restart(uuid);

create function public.reverse_competitive_initialize(p_room uuid, p_rounds integer)
returns void language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if p_rounds not in (3,5,8) then raise exception 'Selecione 3, 5 ou 8 rodadas.'; end if;
 if not exists (select 1 from public.rooms where id=p_room and host_user_id=auth.uid() and status='playing')
 then raise exception 'Somente o anfitrião pode iniciar uma sala em andamento.'; end if;
 select count(*) into n from public.room_players where room_id=p_room;
 if n < 2 then raise exception 'São necessários pelo menos dois jogadores.'; end if;
 insert into public.reverse_competitions(room_id,round_no,start_round,total_rounds,phase)
 values (p_room,0,0,p_rounds,'creator') on conflict(room_id) do nothing;
 insert into public.reverse_competitive_scores(room_id,user_id)
 select p_room,user_id from public.room_players where room_id=p_room on conflict do nothing;
end $$;

-- Nunca avance para REVEAL automaticamente após o envio dos áudios.
-- TODAS as partidas passam por VOTE (inclusive com duas pessoas).
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
 if not public.is_room_member(p_room) or (g.phase='creator' and auth.uid()<>creator)
  or (g.phase='attempts' and auth.uid()=creator) then raise exception 'Não é sua vez.'; end if;
 if p_duration<=0 or p_duration>21 or jsonb_typeof(p_peaks_normal)<>'array'
  or jsonb_typeof(p_peaks_reversed)<>'array' then raise exception 'Áudio inválido.'; end if;
 if p_normal<>'c/'||p_room||'/'||p_round||'/'||auth.uid()||'/normal.wav'
  or p_reversed<>'c/'||p_room||'/'||p_round||'/'||auth.uid()||'/reversed.wav' then raise exception 'Caminho inválido.'; end if;
 if not exists(select 1 from storage.objects where bucket_id='reverse-audio' and name=p_normal)
  or not exists(select 1 from storage.objects where bucket_id='reverse-audio' and name=p_reversed)
  then raise exception 'Áudios ainda não enviados.'; end if;
 insert into public.reverse_competitive_audios(room_id,round_no,user_id,is_creator,normal_path,reversed_path,peaks_normal,peaks_reversed,duration)
 values(p_room,p_round,auth.uid(),auth.uid()=creator,p_normal,p_reversed,p_peaks_normal,p_peaks_reversed,p_duration);
 if g.phase='creator' then
  update public.reverse_competitions set phase='attempts',updated_at=now() where room_id=p_room;
 else
  select count(*) into cnt from public.reverse_competitive_audios where room_id=p_room and round_no=p_round and not is_creator;
  if cnt>=n-1 then
   update public.reverse_competitions set phase='vote',updated_at=now() where room_id=p_room;
  end if;
 end if;
end $$;

-- Para 2 pessoas, o criador avalia a única tentativa (0, 1, 2 ou 3 estrelas).
-- Para 3+, cada membro vota em um áudio de outro jogador, sem auto-voto.
-- Pontos são calculados somente quando TODOS os votos obrigatórios existem.
create function public.reverse_competitive_vote(p_room uuid,p_round integer,p_audio uuid,p_rating integer default null)
returns void language plpgsql security definer set search_path=public as $$
declare g public.reverse_competitions%rowtype; n integer; cnt integer; creator uuid;
begin
 select * into g from public.reverse_competitions where room_id=p_room for update;
 if not found or g.round_no<>p_round or g.phase<>'vote' or not public.is_room_member(p_room)
 then raise exception 'Votação não está aberta.'; end if;
 select count(*) into n from public.room_players where room_id=p_room;
 select user_id into creator from public.reverse_competitive_audios
 where room_id=p_room and round_no=p_round and is_creator;
 if n=2 then
  if auth.uid()<>creator then raise exception 'Só o criador pode avaliar a tentativa nesta rodada.'; end if;
  if p_rating is null or p_rating not between 0 and 3 then raise exception 'Escolha uma nota de 0 a 3.'; end if;
 else
  if p_rating is not null then raise exception 'Votação não permite nota nesta sala.'; end if;
 end if;
 if not exists(select 1 from public.reverse_competitive_audios where id=p_audio and room_id=p_room
  and round_no=p_round and not is_creator and user_id<>auth.uid())
 then raise exception 'Tentativa inválida para voto.'; end if;
 insert into public.reverse_competitive_votes(room_id,round_no,voter_id,audio_id,rating)
 values (p_room,p_round,auth.uid(),p_audio,p_rating);
 select count(*) into cnt from public.reverse_competitive_votes where room_id=p_room and round_no=p_round;
 if n=2 then
  -- Só há um avaliador e uma tentativa: zero pontos sem avaliação explícita.
  update public.reverse_competitive_scores s set points=points + 100*p_rating
  where s.room_id=p_room and s.user_id=(select a.user_id from public.reverse_competitive_audios a where a.id=p_audio);
  update public.reverse_competitive_scores set points=points+50 where room_id=p_room and user_id=creator;
  update public.reverse_competitions set phase='reveal',updated_at=now() where room_id=p_room;
 elsif cnt=n then
  update public.reverse_competitive_scores s set points=points + 100*coalesce((
   select count(*) from public.reverse_competitive_votes v
   join public.reverse_competitive_audios a on a.id=v.audio_id
   where v.room_id=p_room and v.round_no=p_round and a.user_id=s.user_id),0)
  where s.room_id=p_room;
  update public.reverse_competitive_scores s set points=points+150
  where s.room_id=p_room and s.user_id in (
   select a.user_id from public.reverse_competitive_audios a
   left join public.reverse_competitive_votes v on v.audio_id=a.id
   where a.room_id=p_room and a.round_no=p_round and not a.is_creator
   group by a.id having count(v.audio_id)=(
    select max(votes) from (
     select count(v2.audio_id) votes from public.reverse_competitive_audios a2
     left join public.reverse_competitive_votes v2 on v2.audio_id=a2.id
     where a2.room_id=p_room and a2.round_no=p_round and not a2.is_creator
     group by a2.id
    ) t
   )
  );
  update public.reverse_competitive_scores set points=points+50 where room_id=p_room and user_id=creator;
  update public.reverse_competitions set phase='reveal',updated_at=now() where room_id=p_room;
 end if;
end $$;

create or replace function public.reverse_competitive_next(p_room uuid)
returns void language plpgsql security definer set search_path=public as $$
declare g public.reverse_competitions%rowtype;
begin
 select * into g from public.reverse_competitions where room_id=p_room for update;
 if not found or g.phase<>'reveal' or not exists(
  select 1 from public.rooms where id=p_room and host_user_id=auth.uid())
 then raise exception 'Somente o anfitrião pode avançar após a votação.'; end if;
 if g.round_no-g.start_round+1 >= g.total_rounds then
  update public.reverse_competitions set phase='finished',updated_at=now() where room_id=p_room;
 else
  update public.reverse_competitions set round_no=round_no+1,phase='creator',updated_at=now() where room_id=p_room;
 end if;
end $$;

create function public.reverse_competitive_restart(p_room uuid,p_rounds integer)
returns void language plpgsql security definer set search_path=public as $$
declare g public.reverse_competitions%rowtype;
begin
 if p_rounds not in (3,5,8) then raise exception 'Selecione 3, 5 ou 8 rodadas.'; end if;
 select * into g from public.reverse_competitions where room_id=p_room for update;
 if not found or g.phase<>'finished' or not exists(
  select 1 from public.rooms where id=p_room and host_user_id=auth.uid())
 then raise exception 'A revanche só pode começar após o fim da partida, pelo anfitrião.'; end if;
 delete from public.reverse_competitive_votes where room_id=p_room;
 -- Áudios antigos permanecem no banco; número absoluto da rodada evita colisões em Storage.
 update public.reverse_competitive_scores set points=0 where room_id=p_room;
 update public.reverse_competitions set round_no=g.round_no+1,start_round=g.round_no+1,
  total_rounds=p_rounds,phase='creator',updated_at=now() where room_id=p_room;
end $$;

revoke all on function public.reverse_competitive_initialize(uuid,integer),
 public.reverse_competitive_submit(uuid,integer,text,text,jsonb,jsonb,double precision),
 public.reverse_competitive_vote(uuid,integer,uuid,integer),
 public.reverse_competitive_next(uuid),
 public.reverse_competitive_restart(uuid,integer) from public;
grant execute on function public.reverse_competitive_initialize(uuid,integer),
 public.reverse_competitive_submit(uuid,integer,text,text,jsonb,jsonb,double precision),
 public.reverse_competitive_vote(uuid,integer,uuid,integer),
 public.reverse_competitive_next(uuid),
 public.reverse_competitive_restart(uuid,integer) to authenticated;
