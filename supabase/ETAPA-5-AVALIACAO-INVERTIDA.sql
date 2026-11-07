-- ETAPA 5: permite ao criador comparar a frase original com a tentativa invertida.
-- Executar depois de ETAPA-4-VOTOS-RODADAS.sql.

drop policy if exists 'competitive download' on storage.objects;
create policy 'competitive download' on storage.objects for select to authenticated using (
 bucket_id='reverse-audio' and split_part(name,'/',1)='c'
 and exists (
  select 1 from public.reverse_competitions c
  where c.room_id::text=split_part(name,'/',2)
   and public.is_room_member(c.room_id)
   and (
    split_part(name,'/',4)=auth.uid()::text
    or (
     c.round_no::text=split_part(name,'/',3)
     and (
      (
       c.phase='attempts' and split_part(name,'/',5)='reversed.wav'
       and exists (
        select 1 from public.reverse_competitive_audios a
        where a.room_id=c.room_id and a.round_no=c.round_no and a.is_creator
         and a.user_id::text=split_part(name,'/',4)
       )
      )
      or (
       c.phase='vote' and exists (
        select 1 from public.reverse_competitive_audios a
        where a.room_id=c.room_id and a.round_no=c.round_no and not a.is_creator
         and a.user_id::text=split_part(name,'/',4)
         and (
          split_part(name,'/',5)='normal.wav'
          or (
           split_part(name,'/',5)='reversed.wav'
           and (select count(*) from public.room_players p where p.room_id=c.room_id)=2
           and auth.uid()=(
            select creator.user_id from public.reverse_competitive_audios creator
            where creator.room_id=c.room_id and creator.round_no=c.round_no and creator.is_creator
           )
          )
         )
       )
      )
      or c.phase in ('reveal','finished')
     )
    )
   )
 )
);

create or replace function public.reverse_competitive_vote(p_room uuid,p_round integer,p_audio uuid,p_rating integer default null)
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
 if not exists(
  select 1 from public.reverse_competitive_audios
  where id=p_audio and room_id=p_room and round_no=p_round and not is_creator
   and user_id<>auth.uid()
 ) then raise exception 'Tentativa inválida para voto.'; end if;
 insert into public.reverse_competitive_votes(room_id,round_no,voter_id,audio_id,rating)
 values (p_room,p_round,auth.uid(),p_audio,p_rating);
 select count(*) into cnt from public.reverse_competitive_votes where room_id=p_room and round_no=p_round;
 if n=2 then
  update public.reverse_competitive_scores s set points=points + 100*p_rating
  where s.room_id=p_room and s.user_id=(
   select a.user_id from public.reverse_competitive_audios a where a.id=p_audio
  );
  update public.reverse_competitive_scores set points=points+50
  where room_id=p_room and user_id=creator;
  update public.reverse_competitions set phase='reveal',updated_at=now() where room_id=p_room;
 elsif cnt=n then
  update public.reverse_competitive_scores s set points=points + 100*coalesce((
   select count(*) from public.reverse_competitive_votes v
   join public.reverse_competitive_audios a on a.id=v.audio_id
   where v.room_id=p_room and v.round_no=p_round and a.user_id=s.user_id
  ),0) where s.room_id=p_room;
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
  update public.reverse_competitive_scores set points=points+50
  where room_id=p_room and user_id=creator;
  update public.reverse_competitions set phase='reveal',updated_at=now() where room_id=p_room;
 end if;
end $$;

grant execute on function public.reverse_competitive_vote(uuid,integer,uuid,integer) to authenticated;
