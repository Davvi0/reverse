import { supabase } from '../lib/supabase'

const bucket = 'reverse-audio'
const check = ({ error }) => { if (error) throw error }
export async function carregarPartida(roomId) {
  const [game, recordings] = await Promise.all([
    supabase.from('room_games').select('*').eq('room_id', roomId).single(),
    supabase.from('room_recordings').select('*').eq('room_id', roomId).order('turn_index'),
  ])
  check(game); check(recordings)
  return { game: game.data, recordings: recordings.data }
}
export async function enviarGravacao(roomId, turn, userId, resultado) {
  const prefix = `${roomId}/${turn}/${userId}`
  const normal = `${prefix}/normal.wav`, reversed = `${prefix}/reversed.wav`
  for (const [path, blob] of [[normal, resultado.normal.blob], [reversed, resultado.invertido.blob]]) {
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'audio/wav', upsert: false })
    if (error && !/already exists|duplicate/i.test(error.message)) throw error
  }
  check(await supabase.rpc('submit_reverse_recording', {
    p_room_id: roomId, p_turn: turn, p_normal: normal, p_reversed: reversed,
    p_peaks_normal: resultado.normal.picos, p_peaks_reversed: resultado.invertido.picos,
    p_duration: resultado.normal.duracao,
  }))
}
export async function baixarFonte(path, peaks, duration) {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error) throw error
  return { blob: data, picos: peaks, duracao: duration }
}
export async function avancarRevelacao(roomId, next, finish = false) {
  check(await supabase.rpc('advance_reverse_reveal', { p_room_id: roomId, p_next: next, p_finish: finish }))
}
export async function reiniciarPartidaOnline(roomId) {
  check(await supabase.rpc('restart_reverse_game', { p_room_id: roomId }))
}
