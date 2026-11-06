import { useEffect, useRef, useState } from 'react'
import Ico from './Icone'

const VELOCIDADES = [1, 0.75, 0.5]
const tempo = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// fonte = { blob, picos, duracao } (WAV gerado por processarGravacao)
export function Player({ fonte, auto = false, onPlay }) {
  const el = useRef(null)
  const raf = useRef(0)
  const quer = useRef(auto)
  const [url, setUrl] = useState(null)
  const [tocando, setTocando] = useState(false)
  const [prog, setProg] = useState(0)
  const [vel, setVel] = useState(0)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    const u = URL.createObjectURL(fonte.blob)
    quer.current = auto
    setUrl(u)
    setProg(0)
    setTocando(false)
    setAviso('')
    return () => URL.revokeObjectURL(u)
  }, [fonte, auto])

  useEffect(() => {
    if (el.current) el.current.playbackRate = VELOCIDADES[vel]
  }, [vel, url])

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      el.current?.pause()
    },
    []
  )

  async function tocar(reiniciar = false) {
    const a = el.current
    if (!a) return
    if (reiniciar || a.ended) a.currentTime = 0
    try {
      await a.play()
      setAviso('')
    } catch {
      setAviso('O navegador bloqueou o início automático. Toque em ▶ para ouvir.')
    }
  }

  const acompanhar = () => {
    const a = el.current
    if (a && a.duration) setProg(a.currentTime / a.duration)
    raf.current = requestAnimationFrame(acompanhar)
  }

  function buscar(e) {
    const a = el.current
    if (!a) return
    const r = e.currentTarget.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    a.currentTime = f * (a.duration || fonte.duracao)
    setProg(f)
  }

  const fim = prog >= 0.995 && !tocando

  return (
    <div className="rounded-3xl bg-panel border border-line p-4">
      <audio
        ref={el}
        src={url || undefined}
        preload="auto"
        playsInline
        onCanPlay={() => {
          if (quer.current) {
            quer.current = false
            tocar()
          }
        }}
        onLoadedMetadata={() => {
          if (el.current) el.current.playbackRate = VELOCIDADES[vel]
        }}
        onPlay={() => {
          setTocando(true)
          onPlay?.()
          cancelAnimationFrame(raf.current)
          raf.current = requestAnimationFrame(acompanhar)
        }}
        onPause={() => {
          setTocando(false)
          cancelAnimationFrame(raf.current)
        }}
        onEnded={() => {
          setTocando(false)
          setProg(1)
          cancelAnimationFrame(raf.current)
        }}
        onError={() => setAviso('Não foi possível reproduzir este áudio.')}
      />

      <div
        role="slider"
        aria-label="Posição do áudio"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(prog * 100)}
        onPointerDown={buscar}
        className="flex items-center gap-[3px] h-24 cursor-pointer touch-pan-y"
      >
        {fonte.picos.map((p, i) => (
          <span
            key={i}
            className={`flex-1 rounded-full transition-colors ${i / fonte.picos.length < prog ? 'bg-brand' : 'bg-white/15'}`}
            style={{ height: `${p * 100}%` }}
          />
        ))}
      </div>

      <div className="flex justify-between text-xs text-white/50 mt-1 tabular-nums">
        <span>{tempo(prog * fonte.duracao)}</span>
        <span>{tempo(fonte.duracao)}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 items-center">
        <button
          onClick={() => tocar(true)}
          className="justify-self-start flex flex-col items-center gap-1 text-xs text-white/70 min-w-14 py-1"
          aria-label="Repetir do começo"
        >
          <span className="size-11 grid place-items-center rounded-full bg-white/10">
            <Ico n="replay" />
          </span>
          Repetir
        </button>

        <button
          onClick={() => (tocando ? el.current.pause() : tocar())}
          aria-label={tocando ? 'Pausar' : 'Tocar'}
          className="justify-self-center size-16 grid place-items-center rounded-full bg-linear-to-br from-brand to-hot text-ink active:scale-95 transition"
        >
          <Ico n={tocando ? 'pause' : fim ? 'replay' : 'play'} className="size-7" />
        </button>

        <button
          onClick={() => setVel(v => (v + 1) % VELOCIDADES.length)}
          className="justify-self-end flex flex-col items-center gap-1 text-xs text-white/70 min-w-14 py-1"
          aria-label="Mudar velocidade"
        >
          <span className="size-11 grid place-items-center rounded-full bg-white/10 font-display font-bold text-sm text-white">
            {VELOCIDADES[vel]}×
          </span>
          Velocidade
        </button>
      </div>

      {aviso && <p className="mt-3 text-sm text-hot text-center">{aviso}</p>}
    </div>
  )
}

// abas = [{ id, nome, fonte }]; trocar de aba já toca a nova versão
export function PlayerAbas({ abas, auto = false, onPlay }) {
  const [i, setI] = useState(0)
  const [toca, setToca] = useState(auto)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/5 border border-line" role="tablist">
        {abas.map((a, n) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={n === i}
            onClick={() => {
              setI(n)
              setToca(true)
            }}
            className={`min-h-11 rounded-xl text-sm font-semibold transition ${n === i ? 'bg-white text-ink' : 'text-white/60'}`}
          >
            {a.nome}
          </button>
        ))}
      </div>
      <Player fonte={abas[i].fonte} auto={toca} onPlay={onPlay} />
    </div>
  )
}
