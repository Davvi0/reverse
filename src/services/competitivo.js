import { supabase } from '../lib/supabase'

function ok(result) { if (result.error) throw result.error; return result.data }
export async function iniciarCompetitivo(roomId, rounds) {
  return ok(await supabase.rpc('reverse_competitive_initialize', { p_room: roomId, p_rounds: rounds }))
}
export async function lerCompetitivo(roomId) {
  const [game, audios, votos, pontos] = await Promise.all([
    supabase.from('reverse_competitions').select('*').eq('room_id', roomId).maybeSingle(),
    supabase.from('reverse_competitive_audios').select('*').eq('room_id', roomId),
    supabase.from('reverse_competitive_votes').select('*').eq('room_id', roomId),
    supabase.from('reverse_competitive_scores').select('*').eq('room_id', roomId),
  ])
  return { game: ok(game), audios: ok(audios), votos: ok(votos), pontos: ok(pontos) }
}
export async function enviarCompetitivo(roomId, round, userId, result) {
  const base = `c/${roomId}/${round}/${userId}`
  const normal = `${base}/normal.wav`, reversed = `${base}/reversed.wav`
  for (const [path, blob] of [[normal, result.normal.blob], [reversed, result.invertido.blob]]) {
    const r = await supabase.storage.from('reverse-audio').upload(path, blob, { contentType: 'audio/wav', upsert: false })
    if (r.error && !/already exists|duplicate/i.test(r.error.message)) throw r.error
  }
  return ok(await supabase.rpc('reverse_competitive_submit', {
    p_room: roomId, p_round: round, p_normal: normal, p_reversed: reversed,
    p_peaks_normal: result.normal.picos, p_peaks_reversed: result.invertido.picos,
    p_duration: result.normal.duracao,
  }))
}
export async function ouvirCompetitivo(path, peaks, duration) {
  const blob = ok(await supabase.storage.from('reverse-audio').download(path))
  return { blob, picos: peaks, duracao: duration }
}
export async function votarCompetitivo(roomId, round, audioId, rating = null) {
  return ok(await supabase.rpc('reverse_competitive_vote', { p_room: roomId, p_round: round, p_audio: audioId, p_rating: rating }))
}
export async function proximaRodada(roomId) {
  return ok(await supabase.rpc('reverse_competitive_next', { p_room: roomId }))
}
export async function revanche(roomId, rounds) {
  return ok(await supabase.rpc('reverse_competitive_restart', { p_room: roomId, p_rounds: rounds }))
}
