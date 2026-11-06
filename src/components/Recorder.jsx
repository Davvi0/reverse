import { useEffect, useRef, useState } from 'react'
import Ico from './Icone'
import { Btn } from './ui'
import { mensagemErro, processarGravacao } from '../utils/audio'

const LIMITE = 20 // segundos
const BARRAS = 32
const tempo = s => `0:${String(s).padStart(2, '0')}`

export default function Recorder({ onPronto, onEstado, rotulo = 'GRAVAR' }) {
  const [estado, setEstado] = useState('espera') // espera | gravando | processando
  const [erro, setErro] = useState('')
  const [seg, setSeg] = useState(0)
  const r = useRef({})
  const barras = useRef([])
  const vivo = useRef(true)

  const muda = e => {
    setEstado(e)
    onEstado?.(e)
  }

  // libera microfone, medidor e cronômetro
  function soltar() {
    clearInterval(r.current.timer)
    cancelAnimationFrame(r.current.raf)
    r.current.stream?.getTracks().forEach(t => t.stop())
    r.current.ctx?.close?.().catch(() => {})
    r.current.stream = r.current.ctx = null
  }

  useEffect(() => {
    vivo.current = true
    const ref = r
    return () => {
      vivo.current = false
      const rec = ref.current.rec
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null
        try { rec.stop() } catch { /* ignora */ }
      }
      soltar()
    }
  }, [])

  function medidor(stream) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx()
      ctx.resume?.()
      const an = ctx.createAnalyser()
      an.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(an)
      r.current.ctx = ctx

      const buf = new Uint8Array(an.fftSize)
      const hist = Array(BARRAS).fill(0)
      const quadro = () => {
        an.getByteTimeDomainData(buf)
        let s = 0
        for (const v of buf) s += ((v - 128) / 128) ** 2
        hist.shift()
        hist.push(Math.min(1, Math.sqrt(s / buf.length) * 4))
        barras.current.forEach((b, i) => b && (b.style.transform = `scaleY(${0.08 + hist[i] * 0.92})`))
        r.current.raf = requestAnimationFrame(quadro)
      }
      quadro()
    } catch {
      /* o medidor é só visual; a gravação continua */
    }
  }

  async function iniciar() {
    setErro('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErro('Este navegador não suporta gravação de áudio. Use o Chrome ou o Safari atualizados.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      if (!vivo.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }

      const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t =>
        MediaRecorder.isTypeSupported?.(t)
      )
      const rec = tipo ? new MediaRecorder(stream, { mimeType: tipo }) : new MediaRecorder(stream)
      const partes = []

      rec.ondataavailable = e => e.data.size > 0 && partes.push(e.data)
      rec.onerror = () => {
        soltar()
        setErro('Houve um problema na gravação. Tente de novo.')
        muda('espera')
      }
      rec.onstop = async () => {
        soltar()
        muda('processando')
        try {
          const blob = new Blob(partes, { type: rec.mimeType || tipo || '' })
          const resultado = await processarGravacao(blob)
          if (vivo.current) onPronto(resultado)
        } catch (e) {
          console.error(e)
          if (vivo.current) {
            setErro(mensagemErro(e))
            muda('espera')
          }
        }
      }

      r.current.stream = stream
      r.current.rec = rec
      rec.start()
      medidor(stream)

      setSeg(0)
      const t0 = Date.now()
      r.current.timer = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000)
        setSeg(s)
        if (s >= LIMITE) parar()
      }, 250)
      muda('gravando')
    } catch (e) {
      console.error(e)
      const negado = e?.name === 'NotAllowedError' || e?.name === 'SecurityError'
      setErro(
        negado
          ? 'Microfone bloqueado. Libere a permissão do microfone nas configurações do navegador e tente de novo.'
          : 'Não foi possível acessar o microfone.'
      )
    }
  }

  function parar() {
    const rec = r.current.rec
    if (rec?.state === 'recording') rec.stop()
  }

  return (
    <div className="space-y-3">
      {erro && (
        <p role="alert" className="text-sm text-red-200 bg-red-500/10 border border-red-400/20 rounded-xl p-3">
          {erro}
        </p>
      )}

      {estado === 'gravando' && (
        <div className="flex items-center justify-center gap-[3px] h-12" aria-hidden="true">
          {Array.from({ length: BARRAS }, (_, i) => (
            <span
              key={i}
              ref={el => (barras.current[i] = el)}
              className="w-1.5 h-full rounded-full bg-hot"
              style={{ transform: 'scaleY(0.08)' }}
            />
          ))}
        </div>
      )}

      {estado === 'processando' ? (
        <div className="min-h-14 flex items-center justify-center gap-3 font-display font-bold text-accent">
          <span className="size-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          INVERTENDO ÁUDIO…
        </div>
      ) : estado === 'gravando' ? (
        <Btn variante="perigo" onClick={parar}>
          <Ico n="stop" /> PARAR · {tempo(seg)}
        </Btn>
      ) : (
        <Btn onClick={iniciar}>
          <Ico n="mic" /> {rotulo}
        </Btn>
      )}
    </div>
  )
}
