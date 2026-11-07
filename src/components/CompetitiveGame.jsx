import { useCallback, useEffect, useMemo, useState } from 'react'
import Recorder from './Recorder'
import LiveReactions from './LiveReactions'
import BestMoments from './BestMoments'
import { Player, PlayerAbas } from './Player'
import { Btn, Tela } from './ui'
import { supabase } from '../lib/supabase'
import { iniciarCompetitivo, lerCompetitivo, enviarCompetitivo, ouvirCompetitivo, votarCompetitivo, proximaRodada, revanche } from '../services/competitivo'

const FASES = { creator: 'FRASE SECRETA', attempts: 'TENTATIVAS', vote: 'VOTAÇÃO', reveal: 'REVELAÇÃO', finished: 'RESULTADO' }
const OP = [3, 5, 8]

export default function CompetitiveGame({ sala, jogadores, usuarioId, onSair }) {
  const [state, setState] = useState(null)
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(false)
  const [fontes, setFontes] = useState({})
  const [escolha, setEscolha] = useState('')
  const [nota, setNota] = useState(null)
  const [pronto, setPronto] = useState(false)
  const [revealIndex, setRevealIndex] = useState(0)
  const [rodadas, setRodadas] = useState(5)
  const host = jogadores.some(j => j.user_id === usuarioId && j.is_host)
  const nomeDe = id => jogadores.find(j => j.user_id === id)?.player_name || 'Jogador'

  const atualizar = useCallback(async () => {
    try { setState(await lerCompetitivo(sala.id)) }
    catch (e) { setErro(e.message || 'Erro ao carregar partida') }
  }, [sala.id])

  useEffect(() => {
    atualizar()
    const channel = supabase.channel(`reverse-competitive-${sala.id}`)
    for (const table of ['reverse_competitions', 'reverse_competitive_audios', 'reverse_competitive_votes', 'reverse_competitive_scores']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `room_id=eq.${sala.id}` }, atualizar)
    }
    channel.subscribe()
    const interval = setInterval(atualizar, 3500)
    return () => { clearInterval(interval); supabase.removeChannel(channel) }
  }, [sala.id, atualizar])

  const game = state?.game
  const round = game?.round_no ?? 0
  const roundIndex = round - (game?.start_round ?? 0)
  const totalRounds = game?.total_rounds ?? 5
  const audios = useMemo(() => (state?.audios || []).filter(a => a.round_no === round), [state?.audios, round])
  const original = audios.find(a => a.is_creator)
  const creator = original || (jogadores.length ? jogadores[round % jogadores.length] : null)
  const creatorId = creator?.user_id
  const isDuo = jogadores.length === 2
  const tentativas = useMemo(() => audios.filter(a => !a.is_creator).sort((a, b) => a.id.localeCompare(b.id)), [audios])
  const minha = audios.find(a => a.user_id === usuarioId)
  const votos = (state?.votos || []).filter(v => v.round_no === round)
  const jaVotei = votos.some(v => v.voter_id === usuarioId)
  const scores = [...(state?.pontos || [])].sort((a, b) => b.points - a.points)
  const possoGravar = (game?.phase === 'creator' && creatorId === usuarioId) || (game?.phase === 'attempts' && creatorId !== usuarioId && !minha)
  const revelar = game?.phase === 'reveal' || game?.phase === 'finished'
  const itens = useMemo(() => [...tentativas, ...(original ? [original] : [])], [tentativas, original])
  const item = itens[revealIndex]
  const minScore = Math.max(1, scores[0]?.points ?? 1)

  useEffect(() => { setPronto(false); setEscolha(''); setNota(null); setRevealIndex(0) }, [round, game?.phase])
  useEffect(() => {
    if (!game) return
    let ativo = true
    const targets = []
    if (game.phase === 'attempts' && original && creatorId !== usuarioId) targets.push(['desafio', original.reversed_path, original.peaks_reversed, original.duration])
    if (game.phase === 'vote') {
      if (isDuo && creatorId === usuarioId && original) {
        targets.push(['v-original', original.normal_path, original.peaks_normal, original.duration])
      }
      for (const a of tentativas) {
        const path = isDuo ? a.reversed_path : a.normal_path
        const peaks = isDuo ? a.peaks_reversed : a.peaks_normal
        targets.push([`v-${a.id}`, path, peaks, a.duration])
      }
    }
    if (revelar) for (const a of itens) {
      targets.push([`n-${a.id}`, a.normal_path, a.peaks_normal, a.duration])
      targets.push([`r-${a.id}`, a.reversed_path, a.peaks_reversed, a.duration])
    }
    async function load() {
      for (const [key, path, peaks, duration] of targets) {
        if (fontes[key]) continue
        try {
          const src = await ouvirCompetitivo(path, peaks, duration)
          if (ativo) setFontes(prev => ({ ...prev, [key]: src }))
        } catch (e) { if (ativo) setErro(`Áudio: ${e.message}`) }
      }
    }
    load()
    return () => { ativo = false }
  }, [game?.phase, original, creatorId, usuarioId, isDuo, tentativas, itens, fontes, revelar])

  async function executar(fn) {
    setBusy(true); setErro('')
    try { await fn(); await atualizar() }
    catch (e) { setErro(e.message || 'Não foi possível concluir a ação.') }
    finally { setBusy(false) }
  }

  const abrir = !game
  return <Tela>
    <div className="reverse-competitive">
      <header className="rc-header">
        <div className="rc-brand"><span className="rc-brand-mark">R<span>↶</span></span><div><strong>REVERSE</strong><small>COMPETITIVE</small></div></div>
        <button type="button" className="rc-exit" onClick={onSair}>Sair ↗</button>
      </header>
      {erro && <p role="alert" className="rc-error">{erro}</p>}

      {abrir && <section className="rc-stage rc-intro">
        <div className="rc-kicker"><span className="rc-dot"/> SALA {sala.code || 'ONLINE'} · {jogadores.length} JOGADORES</div>
        <h1>Que vença<br/><em>o melhor áudio.</em></h1>
        <p>Reproduza uma frase invertida, desafie seus amigos e conquiste o topo do ranking.</p>
        {host ? <>
          <div className="rc-section-label">QUANTAS RODADAS?</div>
          <div className="rc-round-options">{OP.map(n => <button key={n} type="button" className={`rc-option ${rodadas === n ? 'is-active' : ''}`} aria-pressed={rodadas === n} onClick={() => setRodadas(n)}><strong>{n}</strong><small>RODADAS</small></button>)}</div>
          <Btn className="rc-action" disabled={busy} onClick={() => executar(() => iniciarCompetitivo(sala.id, rodadas))}>{busy ? 'PREPARANDO…' : 'INICIAR COMPETIÇÃO →'}</Btn>
        </> : <div className="rc-wait"><span className="rc-loader"/> Anfitrião escolhendo a quantidade de rodadas…</div>}
      </section>}

      {game && <>
        <div className="rc-progress-head"><span>{FASES[game.phase]}</span><strong>{game.phase === 'finished' ? 'PARTIDA ENCERRADA' : `RODADA ${roundIndex + 1} / ${totalRounds}`}</strong></div>
        <div className="rc-progress"><span style={{ width: `${game.phase === 'finished' ? 100 : (roundIndex / Math.max(1, totalRounds)) * 100}%` }}/></div>

        {(game.phase === 'attempts' || game.phase === 'vote' || game.phase === 'reveal' || game.phase === 'finished') && <LiveReactions roomId={sala.id} userId={usuarioId} name={nomeDe(usuarioId)} />}

        {game.phase === 'creator' && <section className="rc-stage rc-creator" key={`creator-${round}`}>
          <div className="rc-bignumber">{String(roundIndex + 1).padStart(2, '0')}</div>
          <div className="rc-kicker">QUEM CRIA A FRASE</div>
          <h1>{creatorId === usuarioId ? <>Você é o<br/><em>criador.</em></> : <>É a vez de<br/><em>{creator?.player_name || 'alguém'}.</em></>}</h1>
          <p>{creatorId === usuarioId ? 'Grave uma frase curta. Ninguém mais pode ouvir a versão original até a revelação.' : 'Aguarde a frase secreta. Você receberá uma versão invertida para imitar.'}</p>
          {possoGravar && <div className="rc-rec-area">{busy ? <div className="rc-wait"><span className="rc-loader"/> Enviando gravação…</div> : <Recorder onPronto={r => executar(() => enviarCompetitivo(sala.id, round, usuarioId, r))} rotulo="GRAVAR FRASE" />}</div>}
          {creatorId !== usuarioId && <div className="rc-wait"><span className="rc-loader"/> Aguardando o criador…</div>}
        </section>}

        {game.phase === 'attempts' && <section className="rc-stage" key={`attempts-${round}`}>
          <div className="rc-kicker">DESAFIO EM ANDAMENTO</div>
          <h1>{creatorId === usuarioId ? <>Hora das<br/><em>tentativas.</em></> : minha ? <>Áudio<br/><em>enviado!</em></> : <>Ouça.<br/><em>Reproduza.</em></>}</h1>
          <p>{creatorId === usuarioId || minha ? `Aguardando ${Math.max(0, jogadores.length - 1 - tentativas.length)} de ${jogadores.length - 1} tentativa(s).` : 'Escute o áudio ao contrário e grave sua melhor imitação.'}</p>
          {possoGravar && !pronto && <Btn className="rc-action" onClick={() => setPronto(true)}>ESTOU PRONTO →</Btn>}
          {possoGravar && pronto && <div className="rc-rec-area">{fontes.desafio ? <><div className="rc-audio-panel"><span className="rc-section-label">ÁUDIO INVERTIDO</span><Player fonte={fontes.desafio}/></div>{busy ? <div className="rc-wait">Enviando tentativa…</div> : <Recorder onPronto={r => executar(() => enviarCompetitivo(sala.id, round, usuarioId, r))} rotulo="GRAVAR TENTATIVA" />}</> : <div className="rc-wait"><span className="rc-loader"/> Carregando áudio…</div>}</div>}
        </section>}

        {game.phase === 'vote' && <section className="rc-stage rc-voting" key={`vote-${round}`}>
          <div className="rc-kicker">{isDuo ? 'AVALIAÇÃO DO CRIADOR' : 'VOTAÇÃO ANÔNIMA'}</div>
          <h1>{isDuo ? <>Avalie a<br/><em>tentativa.</em></> : <>Quem chegou<br/><em>mais perto?</em></>}</h1>
          <p>{isDuo ? 'Compare a frase que você falou primeiro com a tentativa do oponente e avalie o quanto ela ficou parecida.' : 'Ouça cada áudio e escolha o melhor. Você não pode votar em si mesmo.'}</p>
          {isDuo && creatorId !== usuarioId ? <div className="rc-wait"><span className="rc-loader"/> O criador está comparando a tentativa com a frase original.</div> : jaVotei ? <div className="rc-voted"><div className="rc-check">✓</div><strong>{isDuo ? 'Avaliação enviada' : 'Seu voto foi confirmado'}</strong><p>Os pontos serão atualizados quando a votação terminar.</p></div> : <>
            {isDuo && <div className="rc-audio-panel"><span className="rc-section-label">FRASE QUE VOCÊ FALOU PRIMEIRO</span>{fontes['v-original'] ? <Player fonte={fontes['v-original']}/> : <div className="rc-wait"><span className="rc-loader"/> Carregando áudio…</div>}</div>}
            <div className="rc-vote-options">{tentativas.map((a, i) => <div key={a.id} className={`rc-vote-card ${escolha === a.id ? 'is-selected' : ''}`}>
              <div className="rc-vote-card-top"><span className="rc-index">{String.fromCharCode(65 + i)}</span><div><strong>{isDuo ? 'TENTATIVA INVERTIDA DO OPONENTE' : `ÁUDIO ${String.fromCharCode(65 + i)}`}</strong><small>{a.user_id === usuarioId ? 'SUA GRAVAÇÃO' : 'TENTATIVA ANÔNIMA'}</small></div>{escolha === a.id && <span className="rc-selected-dot">✓</span>}</div>
              {fontes[`v-${a.id}`] ? <Player fonte={fontes[`v-${a.id}`]}/> : <div className="rc-wait"><span className="rc-loader"/> Carregando áudio…</div>}
              {!isDuo && a.user_id !== usuarioId && <button type="button" className={`rc-vote-btn ${escolha === a.id ? 'is-selected' : ''}`} onClick={() => setEscolha(a.id)}>{escolha === a.id ? 'SELECIONADO ✓' : 'ESCOLHER ESTE ÁUDIO'}</button>}
            </div>)}</div>
            {isDuo && <div className="rc-rating-panel"><div className="rc-section-label">O QUANTO A TENTATIVA FICOU PARECIDA?</div><div className="rc-rating-options">{[{n:0,l:'Não chegou perto'},{n:1,l:'Razoável'},{n:2,l:'Muito boa'},{n:3,l:'Excelente'}].map(x => <button type="button" key={x.n} className={`rc-rating ${nota === x.n ? 'is-active' : ''}`} onClick={() => {setNota(x.n);setEscolha(tentativas[0]?.id || '')}}><strong>{x.n * 100} pts</strong><small>{x.l}</small></button>)}</div></div>}
            <Btn className="rc-action" disabled={busy || !escolha || (isDuo && (nota === null || !fontes['v-original'] || !fontes[`v-${escolha}`]))} onClick={() => executar(() => votarCompetitivo(sala.id, round, escolha, isDuo ? nota : null))}>{busy ? 'ENVIANDO…' : isDuo ? 'CONFIRMAR AVALIAÇÃO →' : 'CONFIRMAR MEU VOTO →'}</Btn>
          </>}
        </section>}

        {game.phase === 'reveal' && <section className="rc-stage rc-reveal" key={`reveal-${round}`}>
          <div className="rc-kicker">RESULTADO DA RODADA {roundIndex + 1}</div><h1>Hora da<br/><em>verdade.</em></h1>
          <p>As gravações foram reveladas. Ouçam juntos e confiram o resultado.</p>
          <div className="rc-tabs">{itens.map((a, i) => <button type="button" key={a.id} className={i === revealIndex ? 'is-active' : ''} onClick={() => setRevealIndex(i)}>{a.is_creator ? 'ORIGINAL' : `ÁUDIO ${String.fromCharCode(65 + i)}`}</button>)}</div>
          {item && <div className="rc-reveal-card"><div className="rc-section-label">{item.is_creator ? 'FRASE ORIGINAL' : 'TENTATIVA REVELADA'}</div><h2>{nomeDe(item.user_id)}</h2>{fontes[`n-${item.id}`] && fontes[`r-${item.id}`] ? <PlayerAbas key={item.id} abas={[{id:'normal',nome:'Como foi falado',fonte:fontes[`n-${item.id}`]},{id:'reverse',nome:'Invertido',fonte:fontes[`r-${item.id}`]}]}/> : <div className="rc-wait">Carregando gravação…</div>}{!item.is_creator && <div className="rc-votes-total">{isDuo ? `AVALIAÇÃO: ${((votos.find(v => v.audio_id === item.id)?.rating ?? 0) * 100)} PONTOS` : `${votos.filter(v => v.audio_id === item.id).length} VOTO(S)`}</div>}</div>}
          {host ? <Btn className="rc-action" disabled={busy} onClick={() => executar(() => proximaRodada(sala.id))}>{roundIndex + 1 >= totalRounds ? 'VER RESULTADO FINAL →' : 'PRÓXIMA RODADA →'}</Btn> : <div className="rc-wait"><span className="rc-loader"/> Aguardando o anfitrião continuar…</div>}
        </section>}

        {game.phase === 'finished' && <section className="rc-stage rc-finish"><div className="rc-kicker">CAMPEONATO ENCERRADO</div><div className="rc-trophy">★</div><h1>Temos um<br/><em>campeão.</em></h1><div className="rc-winner-name">{nomeDe(scores[0]?.user_id)}</div><p>{scores[0]?.points ?? 0} pontos conquistados</p><div className="rc-final-rows">{scores.map((s, i) => <div key={s.user_id} className={`rc-final-row ${i === 0 ? 'is-winner' : ''}`}><b>{String(i+1).padStart(2,'0')}</b><span>{nomeDe(s.user_id)}</span><strong>{s.points} pts</strong></div>)}</div><BestMoments audios={state?.audios || []} votos={state?.votos || []} startRound={game.start_round ?? 0} totalRounds={totalRounds} nomeDe={nomeDe} />{host && <><div className="rc-section-label">RODADAS DA REVANCHE</div><div className="rc-round-options">{OP.map(n => <button type="button" key={n} className={`rc-option ${rodadas === n ? 'is-active' : ''}`} onClick={() => setRodadas(n)}><strong>{n}</strong><small>RODADAS</small></button>)}</div><Btn className="rc-action" disabled={busy} onClick={() => executar(() => revanche(sala.id, rodadas))}>JOGAR NOVAMENTE →</Btn></>}</section>}

        {game.phase !== 'finished' && <section className="rc-scoreboard"><div className="rc-score-header"><span>CLASSIFICAÇÃO</span><small>PLACAR AO VIVO</small></div>{scores.length ? scores.map((s, i) => <div key={s.user_id} className="rc-score-row"><div className="rc-score-rank">{String(i+1).padStart(2,'0')}</div><div className="rc-score-detail"><div className="rc-score-name"><strong>{nomeDe(s.user_id)}{s.user_id === usuarioId ? ' · você' : ''}</strong><span>{s.points} <small>PTS</small></span></div><div className="rc-score-bar"><span style={{width: `${Math.max(s.points ? 6 : 0, (s.points / minScore)*100)}%`}}/></div></div></div>) : <p className="rc-wait">Carregando classificação…</p>}</section>}
      </>}
    </div>
  </Tela>
}
