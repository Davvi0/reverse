// Processa uma gravação do microfone: decodifica, limpa silêncio nas pontas,
// normaliza o volume e devolve duas versões em WAV (normal e invertida).
// Usar WAV para tudo garante duração conhecida e reprodução igual em todos os navegadores.

const LIMIAR = 0.02
const MARGEM = 0.12 // segundos mantidos ao redor da voz
const MINIMO = 0.35 // segundos de voz

export async function processarGravacao(blob) {
  if (!blob || blob.size === 0) throw new Error('vazio')

  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) throw new Error('sem-suporte')

  const ctx = new Ctx()
  let buffer
  try {
    const dados = await blob.arrayBuffer()
    buffer = await new Promise((ok, falha) => {
      const r = ctx.decodeAudioData(dados, ok, falha) // callback p/ Safari antigo
      if (r && r.then) r.then(ok, falha)
    })
  } catch {
    throw new Error('decodificacao')
  } finally {
    try { await ctx.close() } catch { /* ignora */ }
  }

  const taxa = buffer.sampleRate
  const n = buffer.length
  const mono = new Float32Array(n)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const canal = buffer.getChannelData(c)
    for (let i = 0; i < n; i++) mono[i] += canal[i] / buffer.numberOfChannels
  }

  let ini = 0
  let fim = n - 1
  while (ini < n && Math.abs(mono[ini]) < LIMIAR) ini++
  while (fim > ini && Math.abs(mono[fim]) < LIMIAR) fim--
  if (ini >= fim) throw new Error('silencio')

  const margem = Math.round(taxa * MARGEM)
  const voz = mono.slice(Math.max(0, ini - margem), Math.min(n, fim + margem + 1))
  if (voz.length / taxa < MINIMO) throw new Error('curto')

  let pico = 0
  for (let i = 0; i < voz.length; i++) pico = Math.max(pico, Math.abs(voz[i]))
  const ganho = Math.min(8, 0.92 / (pico || 1))
  for (let i = 0; i < voz.length; i++) voz[i] *= ganho

  const invertida = voz.slice().reverse()
  const duracao = voz.length / taxa

  return {
    normal: { blob: paraWav(voz, taxa), picos: picos(voz), duracao },
    invertido: { blob: paraWav(invertida, taxa), picos: picos(invertida), duracao },
  }
}

export function mensagemErro(e) {
  switch (e?.message) {
    case 'silencio': return 'Não ouvimos nada. Fale mais perto do microfone e tente de novo.'
    case 'curto': return 'Gravação curta demais. Fale um pouco mais e tente de novo.'
    case 'vazio': return 'A gravação veio vazia. Tente novamente.'
    case 'sem-suporte': return 'Este navegador não suporta processamento de áudio.'
    default: return 'Não foi possível processar o áudio. Tente gravar de novo.'
  }
}

function picos(dados, total = 44) {
  const passo = Math.max(1, Math.floor(dados.length / total))
  const out = []
  for (let b = 0; b < total; b++) {
    let m = 0
    for (let i = b * passo; i < Math.min(dados.length, (b + 1) * passo); i++) m = Math.max(m, Math.abs(dados[i]))
    out.push(m)
  }
  const max = Math.max(...out, 0.0001)
  return out.map(v => Math.max(0.1, v / max))
}

function paraWav(amostras, taxa) {
  const n = amostras.length
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const txt = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }

  txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, taxa, true); v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  txt(36, 'data'); v.setUint32(40, n * 2, true)

  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, amostras[i]))
    v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}
