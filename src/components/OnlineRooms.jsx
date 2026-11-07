import { useCallback, useEffect, useState } from 'react'
import Ico from './Icone'
import CompetitiveGame from './CompetitiveGame'
import { Btn, Etiqueta, Tela, Titulo } from './ui'
import { supabase, supabaseConfigurado } from '../lib/supabase'
import { buscarSala, criarSala, entrarSala, iniciarSala, listarJogadores, observarSala, sairSala } from '../services/salas'

const campo = 'w-full rounded-2xl bg-panel border border-line px-4 py-4 text-white placeholder:text-white/35 outline-none focus:border-brand'
const botaoSecundario = 'w-full min-h-14 rounded-2xl border border-line bg-white/5 px-4 font-bold tracking-wide text-white transition active:scale-[.98] disabled:opacity-40'

export default function OnlineRooms({ onVoltar }) {
  const [etapa, setEtapa] = useState('menu')
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [sala, setSala] = useState(null)
  const [jogadores, setJogadores] = useState([])
  const [usuarioId, setUsuarioId] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!sala?.id) return undefined
    let ativo = true
    const atualizar = async () => {
      try {
        const [salaAtualizada, lista] = await Promise.all([buscarSala(sala.id), listarJogadores(sala.id)])
        if (!ativo) return
        setSala(salaAtualizada)
        setJogadores(lista)
        const { data } = await supabase.auth.getUser()
        if (ativo) setUsuarioId(data.user?.id ?? null)
        if (salaAtualizada.status === 'playing') setEtapa('partida')
      } catch (e) {
        if (ativo) setErro(e.message || 'Não foi possível atualizar a sala.')
      }
    }
    atualizar()
    const parar = observarSala(sala.id, atualizar)
    return () => { ativo = false; parar() }
  }, [sala?.id])

  const executar = useCallback(async (acao) => {
    setCarregando(true)
    setErro('')
    try { await acao() } catch (e) { setErro(e.message || 'Ocorreu um erro. Tente novamente.') }
    finally { setCarregando(false) }
  }, [])

  async function handleCriar() {
    await executar(async () => {
      if (nome.trim().length < 2) throw new Error('Digite um nome com pelo menos 2 caracteres.')
      const nova = await criarSala(nome)
      setSala({ id: nova.room_id, code: nova.room_code, status: 'waiting' })
      setEtapa('sala')
    })
  }

  async function handleEntrar() {
    await executar(async () => {
      if (nome.trim().length < 2) throw new Error('Digite um nome com pelo menos 2 caracteres.')
      if (codigo.trim().length !== 6) throw new Error('O código precisa ter 6 caracteres.')
      const entrada = await entrarSala(codigo, nome)
      setSala({ id: entrada.room_id, code: entrada.room_code, status: 'waiting' })
      setEtapa('sala')
    })
  }

  async function handleIniciar() {
    await executar(async () => iniciarSala(sala.id))
  }

  if (!supabaseConfigurado) {
    return (
      <Tela rodape={<Btn onClick={onVoltar}><Ico n="back" /> VOLTAR</Btn>}>
        <Etiqueta>Modo online</Etiqueta>
        <Titulo className="mt-2">Falta conectar o Supabase</Titulo>
        <p className="mt-3 text-white/65">Antes de criar salas, configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.</p>
      </Tela>
    )
  }

  if (etapa === 'partida' && sala) {
    return <CompetitiveGame sala={sala} jogadores={jogadores} usuarioId={usuarioId} onSair={onVoltar} />
  }

  if (etapa === 'sala' && sala) {
    const souHost = jogadores.some(j => j.user_id === usuarioId && j.is_host)
    return (
      <Tela rodape={souHost ? <Btn onClick={handleIniciar} disabled={carregando || jogadores.length < 2}> {carregando ? 'AGUARDE…' : 'INICIAR PARTIDA'} <Ico n="arrow" /></Btn> : <p className="text-center text-sm text-white/55">Aguardando o anfitrião iniciar a partida…</p>}>
        <button onClick={() => executar(async () => { await sairSala(sala.id); setSala(null); setJogadores([]); setEtapa('menu') })} className="mb-5 flex min-h-10 items-center gap-2 text-sm text-white/60"><Ico n="back" /> Sair da sala</button>
        <Etiqueta>Sala de espera</Etiqueta>
        <Titulo className="mt-2">Convide seus amigos</Titulo>
        <p className="mt-2 text-white/60">Compartilhe este código para seus amigos entrarem.</p>
        <button onClick={() => navigator.clipboard?.writeText(sala.code)} className="mt-5 w-full rounded-3xl border border-brand/40 bg-brand/10 p-5 text-center">
          <span className="block text-xs font-bold tracking-[.2em] text-white/55">CÓDIGO DA SALA</span>
          <strong className="mt-2 block font-display text-4xl tracking-[.22em] text-hot">{sala.code}</strong>
          <span className="mt-2 block text-xs text-white/55">Toque para copiar</span>
        </button>
        <div className="mt-6 flex items-center justify-between"><h2 className="font-display text-lg font-bold">Jogadores</h2><span className="text-sm text-white/50">{jogadores.length}/8</span></div>
        <div className="mt-3 space-y-2">
          {jogadores.map((j, i) => <div key={j.id} className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-3"><span className="grid size-10 place-items-center rounded-full bg-white/10 font-bold">{i + 1}</span><span className="flex-1 font-semibold">{j.player_name}</span>{j.is_host && <span className="text-xs font-bold text-hot">ANFITRIÃO</span>}</div>)}
          {jogadores.length === 0 && <p className="text-sm text-white/50">Carregando participantes…</p>}
        </div>
        {jogadores.length < 2 && <p className="mt-4 text-center text-xs text-white/45">É necessário ter pelo menos 2 jogadores para começar.</p>}
      </Tela>
    )
  }

  return (
    <Tela>
      <button onClick={onVoltar} className="mb-5 flex min-h-10 items-center gap-2 text-sm text-white/60"><Ico n="back" /> Voltar</button>
      <Etiqueta>Multiplayer</Etiqueta>
      <Titulo className="mt-2">Jogue com seus amigos</Titulo>
      <p className="mt-2 text-white/60">Crie uma sala ou entre usando um código de convite.</p>
      <label className="mt-6 block text-sm font-semibold text-white/75">Seu nome</label>
      <input className={`${campo} mt-2`} maxLength={20} placeholder="Como quer aparecer?" value={nome} onChange={e => setNome(e.target.value)} />
      {etapa === 'menu' && <div className="mt-5 space-y-3">
        <Btn onClick={handleCriar} disabled={carregando || nome.trim().length < 2}>
          {carregando ? 'CRIANDO SALA…' : 'CRIAR SALA'} {!carregando && <Ico n="arrow" />}
        </Btn>
        <button className={botaoSecundario} onClick={() => setEtapa('entrar')} disabled={carregando}>ENTRAR COM CÓDIGO</button>
      </div>}
      {etapa === 'entrar' && <div className="mt-5 space-y-3"><label className="block text-sm font-semibold text-white/75">Código da sala</label><input className={campo} maxLength={6} autoCapitalize="characters" placeholder="EX: RV82KP" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /><Btn onClick={handleEntrar} disabled={carregando || nome.trim().length < 2 || codigo.length !== 6}>{carregando ? 'ENTRANDO…' : 'ENTRAR NA SALA'}</Btn><button className={botaoSecundario} onClick={() => setEtapa('menu')}>CANCELAR</button></div>}
      {erro && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{erro}</p>}
    </Tela>
  )
}
