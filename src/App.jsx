import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Ico from './components/Icone'
import Recorder from './components/Recorder'
import OnlineRooms from './components/OnlineRooms'
import { Player, PlayerAbas } from './components/Player'
import { Avatar, Btn, Etiqueta, Folha, Pontos, Segurar, Tela, Titulo } from './components/ui'

const EM_PARTIDA = ['passagem', 'gravacao', 'rodada', 'prontoRevelacao', 'revelacao', 'fim']

export default function App() {
  const [tela, setTela] = useState('inicio')
  const [qtdRodadas, setQtdRodadas] = useState(3)
  const [rodadaLocal, setRodadaLocal] = useState(0)
  const [jogadores, setJogadores] = useState(['Jogador 1', 'Jogador 2', 'Jogador 3'])
  const [idsJogadores, setIdsJogadores] = useState([0, 1, 2])
  const [jogadorNovo, setJogadorNovo] = useState(null)
  const [sorteado, setSorteado] = useState(null)
  const [anuncioSorteio, setAnuncioSorteio] = useState('')
  const [atual, setAtual] = useState(0)
  const [original, setOriginal] = useState(null)
  const [tentativas, setTentativas] = useState([])
  const [estadoRec, setEstadoRec] = useState('espera')
  const [rev, setRev] = useState(0)
  const [ver, setVer] = useState(0)
  const [menu, setMenu] = useState(false)
  const listaJogadoresRef = useRef(null)
  const posicoesAntesSorteioRef = useRef(null)
  const proximoIdJogadorRef = useRef(3)

  const emPartida = EM_PARTIDA.includes(tela)

  useLayoutEffect(() => {
    const posicoesAntes = posicoesAntesSorteioRef.current
    if (!posicoesAntes) return
    posicoesAntesSorteioRef.current = null

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    listaJogadoresRef.current?.querySelectorAll('[data-player-id]').forEach(item => {
      const posicaoAntes = posicoesAntes.get(Number(item.dataset.playerId))
      if (!posicaoAntes) return

      const deslocamento = posicaoAntes - item.getBoundingClientRect().top
      if (Math.abs(deslocamento) < 1) return

      item.animate(
        [{ transform: `translateY(${deslocamento}px)` }, { transform: 'translateY(0)' }],
        { duration: 420, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
      )
    })
  }, [idsJogadores])

  // Itens da revelação: cada tentativa e, por último, a frase original
  const itens = useMemo(
    () => [
      ...tentativas.map(t => ({
        titulo: t.nome,
        cor: t.cor,
        abas: [
          { id: 'rev', nome: 'Revelado', fonte: t.revelado },
          { id: 'fal', nome: 'Como foi falado', fonte: t.falado },
        ],
      })),
      ...(original
        ? [
            {
              titulo: 'Frase original',
              cor: null,
              abas: [
                { id: 'orig', nome: 'Original', fonte: original.normal },
                { id: 'inv', nome: 'Invertida', fonte: original.invertido },
              ],
            },
          ]
        : []),
    ],
    [tentativas, original]
  )

  useEffect(() => {
    if (!emPartida) return
    const aviso = e => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [emPartida])

  useEffect(() => {
    if (!menu) return
    const esc = e => e.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [menu])

  function zerar() {
    setOriginal(null)
    setTentativas([])
    setAtual(0)
    setRev(0)
    setEstadoRec('espera')
  }

  function iniciarPartida() {
    setRodadaLocal(0)
    setJogadores(j => j.map(n => n.trim()))
    zerar()
    setTela('passagem')
  }

  // Reinicia sem recarregar a página: libera áudios, microfone e estado
  function reiniciar(modo) {
    setRodadaLocal(0)
    setMenu(false)
    zerar()
    setTela(modo === 'mesmos' ? 'passagem' : 'jogadores')
  }

  function proximaRodadaLocal() {
    setJogadores(lista => [...lista.slice(1), lista[0]])
    setIdsJogadores(lista => [...lista.slice(1), lista[0]])
    setRodadaLocal(r => r + 1)
    zerar()
    setTela('passagem')
  }

  function confirmarPassagem() {
    setEstadoRec('espera')
    setTela(atual === 0 ? 'gravacao' : 'rodada')
  }

  function fraseGravada(res) {
    setOriginal(res)
    setAtual(1)
    setTela('passagem')
  }

  function tentativaGravada(res) {
    setTentativas(t => [...t, { nome: jogadores[atual], cor: atual, falado: res.normal, revelado: res.invertido }])
    if (atual + 1 < jogadores.length) {
      setAtual(atual + 1)
      setTela('passagem')
    } else {
      setRev(0)
      setTela('prontoRevelacao')
    }
  }

  function mudarQtd(n) {
    const q = Math.max(2, Math.min(8, n))
    setJogadores(j =>
      q > j.length
        ? [...j, ...Array.from({ length: q - j.length }, (_, i) => `Jogador ${j.length + i + 1}`)]
        : j.slice(0, q)
    )
    const novosIds = idsJogadores.slice(0, q)
    while (novosIds.length < q) novosIds.push(proximoIdJogadorRef.current++)
    setIdsJogadores(novosIds)
    setJogadorNovo(q > jogadores.length ? novosIds.at(-1) : null)
    setSorteado(null)
    setAnuncioSorteio('')
  }

  function sortear() {
    listaJogadoresRef.current?.querySelectorAll('[data-player-id]').forEach(item => {
      item.getAnimations().forEach(animation => animation.cancel())
    })
    posicoesAntesSorteioRef.current = new Map(
      Array.from(listaJogadoresRef.current?.querySelectorAll('[data-player-id]') ?? [], item => [
        Number(item.dataset.playerId),
        item.getBoundingClientRect().top,
      ])
    )

    const ordem = idsJogadores.map((_, i) => i)
    for (let i = ordem.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1))
      ;[ordem[i], ordem[k]] = [ordem[k], ordem[i]]
    }

    const novoIdInicial = idsJogadores[ordem[0]]
    setJogadores(j => ordem.map(i => j[i]))
    setIdsJogadores(ordem.map(i => idsJogadores[i]))
    setJogadorNovo(null)
    setSorteado(novoIdInicial)
    setAnuncioSorteio(`${jogadores[ordem[0]]} começa a partida.`)
  }

  const nome = jogadores[atual] ?? ''

  return (
    <div className="min-h-dvh flex flex-col">
      {tela !== 'inicio' && (
        <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 max-w-md w-full mx-auto">
          {tela === 'jogadores' ? (
            <button onClick={() => setTela('inicio')} className="flex items-center gap-1.5 min-h-11 text-white/70">
              <Ico n="back" className="size-4" /> Voltar
            </button>
          ) : (
            <span className="font-display font-bold tracking-[0.25em] text-sm">REVERSE</span>
          )}
          {emPartida && (
            <button
              onClick={() => setMenu(true)}
              className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-white/5 border border-line text-sm font-semibold"
            >
              <Ico n="replay" className="size-4" /> Reiniciar
            </button>
          )}
        </header>
      )}

      <main key={`${tela}-${atual}`} className="flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-4">
        {tela === 'inicio' && (
          <Tela
            rodape={<Btn onClick={() => setTela('jogadores')}>JOGAR AGORA <Ico n="arrow" /></Btn>}
          >
            <div className="flex min-h-[calc(100dvh-10rem)] flex-col items-center justify-center text-center">
              <h1 className="font-display font-bold leading-none tracking-tight text-[clamp(3.2rem,17vw,5.5rem)]">
                <span className="text-hot">REVERSE</span>
                <span
                  aria-hidden="true"
                  className="block -scale-y-100 opacity-20 -mt-[0.1em] text-hot [mask-image:linear-gradient(to_bottom,black,transparent_65%)]"
                >
                  REVERSE
                </span>
              </h1>

              <div className="flex items-center justify-center gap-[3px] h-14 mt-2" aria-hidden="true">
                {Array.from({ length: 31 }, (_, i) => (
                  <span
                    key={i}
                    className="w-1.5 rounded-full bg-linear-to-t from-brand to-hot animate-onda"
                    style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${i * 70}ms` }}
                  />
                ))}
              </div>
              <p className="mt-5 text-lg font-semibold tracking-wide text-white/80">Escute. Inverta. Descubra.</p>
              <button onClick={() => setTela('online')} className="mt-6 min-h-12 rounded-2xl border border-line bg-white/5 px-5 text-sm font-bold tracking-wide text-white transition active:scale-95">JOGAR ONLINE <Ico n="arrow" className="ml-1 inline size-4" /></button>
            </div>
          </Tela>
        )}

        {tela === 'online' && <OnlineRooms onVoltar={() => setTela('inicio')} />}

        {tela === 'jogadores' && (
          <Tela
            rodape={
              <Btn onClick={iniciarPartida} disabled={jogadores.some(n => !n.trim())}>
                CONTINUAR <Ico n="arrow" />
              </Btn>
            }
          >
            <Etiqueta>Nova partida</Etiqueta>
            <Titulo className="mt-2">Quem vai jogar?</Titulo>
            <p className="mt-2 text-white/60">O primeiro da lista grava a frase secreta.</p>

            <div className="mt-6 flex items-center justify-between rounded-2xl bg-panel border border-line p-2">
              <button
                onClick={() => mudarQtd(jogadores.length - 1)}
                disabled={jogadores.length <= 2}
                aria-label="Menos um jogador"
                className="size-12 grid place-items-center rounded-xl bg-white/5 disabled:opacity-30"
              >
                <Ico n="minus" />
              </button>
              <span className="font-display font-bold text-lg">{jogadores.length} jogadores</span>
              <button
                onClick={() => mudarQtd(jogadores.length + 1)}
                disabled={jogadores.length >= 8}
                aria-label="Mais um jogador"
                className="size-12 grid place-items-center rounded-xl bg-white/5 disabled:opacity-30"
              >
                <Ico n="plus" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-line bg-panel p-4">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-hot">Duração da partida</p>
              <p className="mt-1 text-sm text-white/55">Cada rodada tem uma frase e uma revelação.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[3, 5, 8].map(n => <button key={n} type="button" onClick={() => setQtdRodadas(n)} aria-pressed={qtdRodadas === n} className={`rounded-xl border px-2 py-3 text-sm font-bold ${qtdRodadas === n ? 'border-brand bg-brand/15 text-hot' : 'border-line bg-white/5 text-white/65'}`}>{n} rodadas</button>)}
              </div>
            </div>

            <ul ref={listaJogadoresRef} className="mt-4 space-y-2.5">
              {jogadores.map((n, i) => (
                <li
                  key={idsJogadores[i]}
                  data-player-id={idsJogadores[i]}
                  className={`player-row flex items-center gap-3 rounded-2xl ${idsJogadores[i] === sorteado ? 'player-row--winner' : ''} ${idsJogadores[i] === jogadorNovo ? 'player-row--enter' : ''}`}
                >
                  <Avatar nome={n} i={i} />
                  <div className="flex-1 min-w-0">
                    <input
                      value={n}
                      maxLength={14}
                      autoComplete="off"
                      enterKeyHint="next"
                      aria-label={`Nome do jogador ${i + 1}`}
                      onChange={e => setJogadores(j => j.map((x, k) => (k === i ? e.target.value : x)))}
                      className="w-full min-h-12 bg-panel border border-line rounded-xl px-4 outline-none focus:border-brand"
                    />
                    {i === 0 && (
                      <p className="text-[11px] text-accent mt-1 ml-1">
                        {idsJogadores[i] === sorteado ? 'começa a partida' : 'grava a frase secreta'}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <p className="sr-only" aria-live="polite">{anuncioSorteio}</p>
            <Btn variante="ghost" onClick={sortear} className="mt-5 min-h-12 text-sm">
              <Ico n="shuffle" className="size-4" /> Sortear quem começa
            </Btn>
          </Tela>
        )}

        {tela === 'passagem' && (
          <Tela
            rodape={<Segurar onConfirm={confirmarPassagem}>SEGURE · SOU {nome.toUpperCase()}</Segurar>}
          >
            <div className="flex min-h-[55dvh] flex-col items-center justify-center text-center">
              <div className="relative">
                <span className="absolute inset-0 rounded-2xl bg-brand/40 animate-anel" />
                <Avatar nome={nome} i={atual} className="relative size-28 text-5xl" />
              </div>
              <Etiqueta className="mt-6">Rodada {rodadaLocal + 1} de {qtdRodadas}</Etiqueta>
              <Titulo className="mt-3">{nome}, sua vez</Titulo>
              <p className="mt-3 text-sm text-white/60">Só {nome} deve olhar a tela.</p>
            </div>
          </Tela>
        )}

        {tela === 'gravacao' && (
          <Tela
            rodape={<Recorder onPronto={fraseGravada} onEstado={setEstadoRec} rotulo="GRAVAR FRASE SECRETA" />}
          >
            <div className="flex min-h-[55dvh] flex-col items-center justify-center text-center">
              <Titulo>Diga uma frase, {nome}</Titulo>
              <div className="mt-8 grid place-items-center">
                <div className="relative size-28 grid place-items-center">
                  {estadoRec === 'gravando' && <span className="absolute inset-0 rounded-full bg-hot/30 animate-anel" />}
                  <span
                    className={`relative size-20 grid place-items-center rounded-full transition-colors ${
                      estadoRec === 'gravando' ? 'bg-red-500' : 'bg-brand'
                    }`}
                  >
                    <Ico n="mic" className="size-8" />
                  </span>
                </div>
              </div>
            </div>
          </Tela>
        )}

        {tela === 'rodada' && original && (
          <Tela rodape={<Recorder onPronto={tentativaGravada} onEstado={setEstadoRec} rotulo="GRAVAR MINHA TENTATIVA" />}>
            <div className="mt-4 flex flex-col items-center text-center">
              <Avatar nome={nome} i={atual} />
              <Titulo className="mt-3">Ouça e repita, {nome}</Titulo>
            </div>

            <div className="mt-5">
              <Player fonte={original.invertido} />
            </div>
          </Tela>
        )}

        {tela === 'prontoRevelacao' && (
          <Tela
            rodape={
              <Btn
                onClick={() => {
                  setRev(0)
                  setTela('revelacao')
                }}
              >
                COMEÇAR REVELAÇÃO <Ico n="arrow" />
              </Btn>
            }
          >
            <Etiqueta>Última etapa</Etiqueta>
            <Titulo className="mt-2">Hora da revelação!</Titulo>
            <p className="mt-3 text-white/60">
              Todos gravaram. Agora o celular vai para o centro da mesa e todo mundo escuta junto.
            </p>
            <ul className="mt-6 space-y-2">
              {tentativas.map((t, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl bg-panel border border-line p-3">
                  <Avatar nome={t.nome} i={t.cor} className="size-10 text-lg" />
                  <span className="font-semibold">{t.nome}</span>
                  <Ico n="check" className="size-4 ml-auto text-accent" />
                </li>
              ))}
              <li className="flex items-center gap-3 rounded-2xl border border-brand/50 bg-brand/10 p-3">
                <span className="size-10 grid place-items-center rounded-2xl bg-linear-to-br from-brand to-hot">
                  <Ico n="star" className="size-5" />
                </span>
                <span className="font-semibold">Frase original</span>
                <span className="ml-auto text-xs text-accent">no final</span>
              </li>
            </ul>
          </Tela>
        )}

        {tela === 'revelacao' && itens[rev] && (
          <Tela
            rodape={
              <div className="flex gap-3">
                {rev > 0 && (
                  <button
                    onClick={() => setRev(rev - 1)}
                    aria-label="Anterior"
                    className="size-14 shrink-0 grid place-items-center rounded-2xl bg-white/5 border border-line"
                  >
                    <Ico n="back" />
                  </button>
                )}
                <Btn
                  onClick={() => {
                    if (rev < itens.length - 1) setRev(rev + 1)
                    else {
                      setVer(itens.length - 1)
                      setTela('fim')
                    }
                  }}
                >
                  {rev === itens.length - 1 ? 'VER RESUMO' : rev === itens.length - 2 ? 'REVELAR A FRASE ORIGINAL' : 'PRÓXIMO'}
                  <Ico n="arrow" />
                </Btn>
              </div>
            }
          >
            <Pontos total={itens.length} atual={rev} />
            <div className="mt-6 text-center">
              <Etiqueta>{rev === itens.length - 1 ? 'O momento da verdade' : `Tentativa ${rev + 1} de ${itens.length - 1}`}</Etiqueta>
              <div className="mt-4 flex items-center justify-center gap-3">
                {itens[rev].cor !== null && <Avatar nome={itens[rev].titulo} i={itens[rev].cor} />}
                <h2 className="font-display font-bold text-4xl break-words">{itens[rev].titulo}</h2>
              </div>
            </div>
            <div className="mt-6">
              <PlayerAbas key={rev} abas={itens[rev].abas} auto />
            </div>
            <p className="mt-4 text-center text-sm text-white/50">
              Toque em Repetir para ouvir de novo quantas vezes quiser.
            </p>
          </Tela>
        )}

        {tela === 'fim' && itens[ver] && (
          <Tela
            rodape={
              <>
                {rodadaLocal + 1 < qtdRodadas ? (
                  <Btn onClick={proximaRodadaLocal}>
                    PRÓXIMA RODADA ({rodadaLocal + 2}/{qtdRodadas}) <Ico n="arrow" />
                  </Btn>
                ) : (
                  <Btn onClick={() => reiniciar('mesmos')}>
                    <Ico n="replay" /> JOGAR DE NOVO
                  </Btn>
                )}
                <Btn variante="ghost" onClick={() => reiniciar('trocar')}>
                  TROCAR JOGADORES
                </Btn>
              </>
            }
          >
            <Etiqueta>Rodada {rodadaLocal + 1} de {qtdRodadas}</Etiqueta>
            <Titulo className="mt-2">{rodadaLocal + 1 === qtdRodadas ? 'Partida concluída!' : 'Reveja a rodada'}</Titulo>
            <p className="mt-2 text-white/60">Escolha um jogador e ouça de novo.</p>

            <div className="mt-5 -mx-5 px-5 flex gap-2 overflow-x-auto pb-2">
              {itens.map((it, i) => (
                <button
                  key={i}
                  onClick={() => setVer(i)}
                  className={`shrink-0 min-h-11 px-4 rounded-full text-sm font-semibold border transition ${
                    i === ver ? 'bg-white text-ink border-white' : 'bg-white/5 border-line text-white/70'
                  }`}
                >
                  {it.titulo}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <PlayerAbas key={ver} abas={itens[ver].abas} />
            </div>
          </Tela>
        )}
      </main>

      <Folha aberta={menu} onFechar={() => setMenu(false)}>
        <h3 className="font-display font-bold text-xl">Reiniciar a partida?</h3>
        <p className="text-sm text-white/60">Todas as gravações serão apagadas. A página não recarrega.</p>
        <Btn onClick={() => reiniciar('mesmos')}>RECOMEÇAR COM OS MESMOS JOGADORES</Btn>
        <Btn variante="ghost" onClick={() => reiniciar('trocar')}>TROCAR JOGADORES</Btn>
        <Btn variante="ghost" onClick={() => setMenu(false)}>CANCELAR</Btn>
      </Folha>
    </div>
  )
}
