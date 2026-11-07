import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar, Btn, Etiqueta, Tela, Titulo } from './ui'
import Recorder from './Recorder'
import { Player, PlayerAbas } from './Player'
import { supabase } from '../lib/supabase'
import { carregarPartida, enviarGravacao, baixarFonte, avancarRevelacao, reiniciarPartidaOnline } from '../services/partidaOnline'

export default function OnlineGame({ sala, jogadores, usuarioId, onSair }) {
  const [game, setGame] = useState(null)
  const [recordings, setRecordings] = useState([])
  const [fontes, setFontes] = useState({})
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [liberado, setLiberado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const host = jogadores.some(p => p.user_id === usuarioId && p.is_host)
  const turno = game?.turn_index ?? 0
  const daVez = jogadores[turno]
  const minhaVez = game?.phase === 'recording' && daVez?.user_id === usuarioId
  const atualizar = useCallback(async () => {
    try {
      const data = await carregarPartida(sala.id)
      setGame(data.game); setRecordings(data.recordings)
    } catch (e) { setErro(e.message) }
  }, [sala.id])
  useEffect(() => {
    atualizar()
    const channel = supabase.channel(`reverse-game-${sala.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_games', filter: `room_id=eq.${sala.id}` }, atualizar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_recordings', filter: `room_id=eq.${sala.id}` }, atualizar)
      .subscribe()
    // Fallback quando uma conexão Realtime fica indisponível.
    const timer = setInterval(atualizar, 5000)
    return () => { clearInterval(timer); supabase.removeChannel(channel) }
  }, [sala.id, atualizar])
  useEffect(() => { setLiberado(false) }, [turno, game?.phase])
  useEffect(() => {
    let alive = true
    async function buscar() {
      const desejados = []
      if (game?.phase === 'recording' && turno > 0 && recordings[0]) desejados.push([`0-reversed`, recordings[0].reversed_path, recordings[0].peaks_reversed, recordings[0].duration])
      if (game?.phase === 'reveal' || game?.phase === 'finished') {
        for (const r of recordings) {
          desejados.push([`${r.turn_index}-normal`, r.normal_path, r.peaks_normal, r.duration])
          desejados.push([`${r.turn_index}-reversed`, r.reversed_path, r.peaks_reversed, r.duration])
        }
      }
      for (const [key, path, peaks, duration] of desejados) {
        if (fontes[key]) continue
        try {
          const source = await baixarFonte(path, peaks, duration)
          if (alive) setFontes(old => ({ ...old, [key]: source }))
        } catch (e) { if (alive) setErro(`Não foi possível carregar áudio: ${e.message}`) }
      }
    }
    buscar()
    return () => { alive = false }
  }, [game?.phase, turno, recordings, fontes])
  const itens = useMemo(() => {
    if (recordings.length !== jogadores.length) return []
    return [...recordings.slice(1).map(r => ({
      nome: jogadores[r.turn_index]?.player_name || 'Jogador',
      abas: [{ id: 'rev', nome: 'Revelado', fonte: fontes[`${r.turn_index}-reversed`] }, { id: 'fal', nome: 'Como foi falado', fonte: fontes[`${r.turn_index}-normal`] }],
    })), { nome: 'Frase original', abas: [{ id: 'orig', nome: 'Original', fonte: fontes['0-normal'] }, { id: 'inv', nome: 'Invertida', fonte: fontes['0-reversed'] }] }]
  }, [recordings, jogadores, fontes])
  async function gravar(resultado) {
    setEnviando(true); setErro('')
    try { await enviarGravacao(sala.id, turno, usuarioId, resultado); await atualizar() }
    catch (e) { setErro(`Erro ao enviar gravação: ${e.message}`) }
    finally { setEnviando(false) }
  }
  async function acao(fn) {
    setCarregando(true); setErro('')
    try { await fn(); await atualizar() } catch (e) { setErro(e.message) }
    finally { setCarregando(false) }
  }
  if (!game) return <Tela><Titulo>Carregando partida…</Titulo>{erro && <p role="alert">{erro}</p>}</Tela>
  const revelando = game.phase === 'reveal' || game.phase === 'finished'
  const item = itens[game.reveal_index]
  return <Tela>
    <div className="flex items-center justify-between gap-2">
      <Etiqueta>Sala {sala.code} · {revelando ? 'Revelação' : `Rodada ${turno + 1}/${jogadores.length}`}</Etiqueta>
      <button className="text-xs text-white/60 underline" onClick={onSair}>Sair</button>
    </div>
    {erro && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{erro}</p>}
    {game.phase === 'recording' && <div className="mt-8">
      <div className="flex justify-center"><Avatar nome={daVez?.player_name || '?'} i={turno} className="size-20 text-3xl" /></div>
      <Titulo className="mt-5 text-center">{minhaVez ? 'Sua vez!' : `Vez de ${daVez?.player_name || 'outro jogador'}`}</Titulo>
      {minhaVez ? <>
        {!liberado ? <div className="mt-6 space-y-5 text-center"><p className="text-white/65">{turno === 0 ? 'Grave uma frase secreta.' : 'Ouça o áudio invertido e tente repetir a frase.'}</p><Btn onClick={() => setLiberado(true)}>ESTOU PRONTO</Btn></div> : <div className="mt-6 space-y-6">
          {turno > 0 && (fontes['0-reversed'] ? <Player fonte={fontes['0-reversed']} /> : <p className="text-white/60">Carregando áudio invertido…</p>)}
          {enviando ? <p className="text-center font-bold text-hot">ENVIANDO GRAVAÇÃO…</p> : (turno === 0 || fontes['0-reversed']) && <Recorder key={turno} onPronto={gravar} rotulo={turno === 0 ? 'GRAVAR FRASE SECRETA' : 'GRAVAR MINHA TENTATIVA'} />}
        </div>}
      </> : <p className="mt-5 text-center text-white/60">Aguarde a gravação do jogador. A próxima etapa aparecerá automaticamente.</p>}
    </div>}
    {revelando && <div className="mt-6 space-y-5">
      <Titulo>{game.phase === 'finished' ? 'Fim de jogo!' : 'Hora da revelação!'}</Titulo>
      <p className="text-white/60">{game.phase === 'finished' ? 'Escute novamente as gravações.' : 'Todos podem ouvir. O anfitrião controla a sequência.'}</p>
      {game.phase === 'finished' && <div className="flex gap-2 flex-wrap">{itens.map((it, i) => <button key={i} className={`rounded-xl px-3 py-2 border ${i === game.reveal_index ? 'border-hot' : 'border-line'}`} onClick={() => setGame(g => ({ ...g, reveal_index: i }))}>{it.nome}</button>)}</div>}
      {item && <><h2 className="font-display font-bold text-2xl">{item.nome}</h2>{item.abas.every(a => a.fonte) ? <PlayerAbas key={`${game.reveal_index}-${game.phase}`} abas={item.abas} /> : <p>Carregando gravações…</p>}</>}
      {host && game.phase === 'reveal' && <div className="flex gap-2">
        {game.reveal_index > 0 && <button disabled={carregando} className="rounded-xl border border-line px-4" onClick={() => acao(() => avancarRevelacao(sala.id, game.reveal_index - 1))}>ANTERIOR</button>}
        <Btn disabled={carregando} onClick={() => acao(() => avancarRevelacao(sala.id, game.reveal_index + 1, game.reveal_index === itens.length - 1))}>{game.reveal_index === itens.length - 1 ? 'FINALIZAR' : 'PRÓXIMO'}</Btn>
      </div>}
      {host && game.phase === 'finished' && <Btn disabled={carregando} onClick={() => acao(() => reiniciarPartidaOnline(sala.id))}>JOGAR DE NOVO</Btn>}
    </div>}
  </Tela>
}
