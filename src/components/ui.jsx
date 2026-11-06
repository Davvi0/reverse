import { useEffect, useRef, useState } from 'react'
import Ico from './Icone'

export const CORES = [
  { fundo: '#ff5284', texto: '#171529' },
  { fundo: '#ffca52', texto: '#171529' },
  { fundo: '#45d9b8', texto: '#171529' },
  { fundo: '#7663bd', texto: '#ffffff' },
  { fundo: '#ff8e72', texto: '#171529' },
  { fundo: '#83e7cf', texto: '#171529' },
  { fundo: '#ac9be8', texto: '#171529' },
  { fundo: '#edb846', texto: '#171529' },
]

export function Avatar({ nome, i, className = 'size-12 text-xl' }) {
  const cor = CORES[i % CORES.length]

  return (
    <span
      className={`${className} shrink-0 grid place-items-center rounded-2xl font-display font-bold`}
      style={{ background: cor.fundo, color: cor.texto }}
    >
      {(nome.trim()[0] || '?').toUpperCase()}
    </span>
  )
}

const BASE =
  'w-full min-h-14 px-6 rounded-2xl font-display font-bold tracking-wide text-base inline-flex items-center justify-center gap-2 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none'
const VARIANTES = {
  primario: 'bg-linear-to-r from-brand to-hot text-ink shadow-[0_10px_30px_-10px_rgba(255,82,132,0.55)]',
  ghost: 'bg-white/5 border border-line text-white hover:bg-white/10',
  perigo: 'bg-red-500 text-white',
}

export function Btn({ variante = 'primario', className = '', ...p }) {
  return <button className={`${BASE} ${VARIANTES[variante]} ${className}`} {...p} />
}

export function Etiqueta({ children, className = '' }) {
  return <p className={`text-xs font-semibold tracking-[0.22em] uppercase text-accent ${className}`}>{children}</p>
}

export function Titulo({ children, className = '' }) {
  return (
    <h2 className={`font-display font-bold leading-[1.05] tracking-tight text-[clamp(2rem,9vw,2.75rem)] ${className}`}>
      {children}
    </h2>
  )
}

// Conteúdo rolável + rodapé de ações fixo ao polegar (padrão mobile)
export function Tela({ children, rodape }) {
  return (
    <section className="flex-1 flex flex-col page-enter">
      <div className="flex-1">{children}</div>
      {rodape && (
        <div className="sticky bottom-0 -mx-5 px-5 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-linear-to-t from-ink from-60% to-transparent space-y-3">
          {rodape}
        </div>
      )}
    </section>
  )
}

export function Pontos({ total, atual }) {
  return (
    <div className="flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={atual}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${i < atual ? 'bg-accent' : i === atual ? 'bg-brand' : 'bg-white/10'}`}
        />
      ))}
    </div>
  )
}

// itens: [{ t, d, s: 'feito' | 'atual' | 'espera' }]
export function Passos({ itens }) {
  return (
    <ol className="space-y-2.5">
      {itens.map((it, i) => (
        <li
          key={i}
          className={`flex gap-3 rounded-2xl border p-3.5 transition-all duration-300 ease-out ${
            it.s === 'atual' ? 'border-brand/60 bg-brand/10' : 'border-line bg-panel'
          } ${it.s === 'feito' ? 'opacity-60' : ''}`}
        >
          <span
            className={`size-7 shrink-0 grid place-items-center rounded-full text-sm font-bold ${
              it.s === 'feito' ? 'bg-accent text-ink' : it.s === 'atual' ? 'bg-brand text-ink' : 'bg-white/10 text-white/60'
            }`}
          >
            {it.s === 'feito' ? <Ico n="check" className="size-4" /> : i + 1}
          </span>
          <div>
            <p className="font-semibold leading-tight">{it.t}</p>
            {it.d && <p className="text-sm text-white/55 mt-0.5">{it.d}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

// Botão que exige segurar: evita que o jogador anterior avance sem querer
export function Segurar({ children, onConfirm, ms = 700 }) {
  const [p, setP] = useState(0)
  const raf = useRef(0)
  const t0 = useRef(0)

  const parar = () => {
    cancelAnimationFrame(raf.current)
    setP(0)
  }
  const passo = t => {
    const v = Math.min(1, (t - t0.current) / ms)
    setP(v)
    if (v >= 1) onConfirm()
    else raf.current = requestAnimationFrame(passo)
  }
  const comecar = () => {
    t0.current = performance.now()
    raf.current = requestAnimationFrame(passo)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return (
    <button
      onPointerDown={comecar}
      onPointerUp={parar}
      onPointerLeave={parar}
      onPointerCancel={parar}
      onContextMenu={e => e.preventDefault()}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onConfirm()
        }
      }}
      className={`${BASE} ${VARIANTES.primario} relative overflow-hidden touch-none`}
    >
      <span className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${p * 100}%` }} />
      <span className="relative">{children}</span>
    </button>
  )
}

export function Folha({ aberta, onFechar, children }) {
  if (!aberta) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sheet-backdrop" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-panel border border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3 sheet-enter"
      >
        {children}
      </div>
    </div>
  )
}
