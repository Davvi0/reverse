import { useMemo, useState } from 'react'
import { PlayerAbas } from './Player'
import { ouvirCompetitivo } from '../services/competitivo'

// Os destaques são derivados das gravações e dos votos já salvos no Supabase.
// Não dependem de uma tabela adicional e continuam disponíveis após atualizar a página.
export default function BestMoments({ audios, votos, startRound, totalRounds, nomeDe }) {
  const [selected, setSelected] = useState(null)
  const [sources, setSources] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const highlights = useMemo(() => {
    const eligible = (audios || []).filter(a => !a.is_creator &&
      a.round_no >= startRound && a.round_no < startRound + totalRounds)
    return eligible.map(a => {
      const received = (votos || []).filter(v => v.audio_id === a.id)
      const rating = received.length ? received[0]?.rating : null
      const score = rating == null ? received.length * 100 : rating * 100
      return { ...a, score, votes: received.length, rating }
    }).sort((a,b) => b.score - a.score || a.round_no - b.round_no || a.id.localeCompare(b.id)).slice(0, 5)
  }, [audios, votos, startRound, totalRounds])

  const active = highlights.find(a => a.id === selected)
  const current = active && sources[active.id]

  async function choose(a) {
    setSelected(a.id)
    setError('')
    if (sources[a.id]) return
    setLoading(true)
    try {
      const [normal, reversed] = await Promise.all([
        ouvirCompetitivo(a.normal_path, a.peaks_normal, a.duration),
        ouvirCompetitivo(a.reversed_path, a.peaks_reversed, a.duration),
      ])
      setSources(prev => ({ ...prev, [a.id]: { normal, reversed } }))
    } catch (e) { setError(e.message || 'Não foi possível carregar o áudio.') }
    finally { setLoading(false) }
  }

  if (!highlights.length) return null
  return <section className="rc-highlights" aria-label="Melhores momentos">
    <div className="rc-highlights-heading">
      <span className="rc-kicker">REPLAY DA PARTIDA</span>
      <h2>Os melhores<br/><em>momentos.</em></h2>
      <p>As tentativas mais votadas, reunidas para vocês ouvirem de novo.</p>
    </div>
    <div className="rc-highlights-list">
      {highlights.map((a, i) => <button type="button" key={a.id}
        className={`rc-highlight-item ${selected === a.id ? 'is-active' : ''}`}
        onClick={() => choose(a)} aria-pressed={selected === a.id}>
        <span className="rc-highlight-rank">{String(i+1).padStart(2, '0')}</span>
        <span className="rc-highlight-person"><strong>{nomeDe(a.user_id)}</strong><small>RODADA {a.round_no - startRound + 1} · {i === 0 ? 'MAIS VOTADO' : 'DESTAQUE'}</small></span>
        <span className="rc-highlight-points">{a.rating == null ? `${a.votes} ${a.votes === 1 ? 'voto' : 'votos'}` : `${a.score} pts`}</span>
        <span className="rc-highlight-play" aria-hidden="true">▶</span>
      </button>)}
    </div>
    {active && <div className="rc-highlight-player">
      <div className="rc-highlight-player-top"><span>OUVINDO AGORA</span><strong>{nomeDe(active.user_id)} · RODADA {active.round_no-startRound+1}</strong></div>
      {loading && <p className="rc-highlight-message">Carregando gravações…</p>}
      {error && <p className="rc-error" role="alert">{error}</p>}
      {current && <PlayerAbas key={active.id} abas={[
        {id:'original',nome:'Tentativa',fonte:current.normal},
        {id:'reverse',nome:'Ao contrário',fonte:current.reversed},
      ]}/>}
    </div>}
  </section>
}
