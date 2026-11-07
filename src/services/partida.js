import { supabase } from '../lib/supabase'
const BUCKET = 'reverse-audios'

export async function obterPartida(roomId) {
  const { data, error } = await supabase.rpc('game_snapshot', { p_room_id: roomId })
  if (error) throw error
  return data
}

export async function enviarGravacao(roomId, turno, audio) {
  const prefixo = `${roomId}/${crypto.randomUUID()}`
  const normal = `${prefixo}-normal.wav`
  const reversed = `${prefixo}-reverse.wav`
  for (const [path, fonte] of [[normal, audio.normal], [reversed, audio.invertido]]) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, fonte.blob, { contentType: 'audio/wav', upsert: false })
    if (error) throw error
  }
  const { error } = await supabase.rpc('game_submit_recording', {
    p_room_id: roomId, p_turn: turno, p_normal: normal, p_reversed: reversed,
    p_normal_peaks: audio.normal.picos, p_reversed_peaks: audio.invertido.picos,
    p_duration: audio.normal.duracao,
  })
  if (error) throw error
}

export async function obterAudio(path, picos, duracao) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  return { blob: data, picos, duracao: Number(duracao) }
}

export async function mudarRevelacao(roomId, indice, finalizar = false) {
  const { error } = await supabase.rpc('game_set_reveal', { p_room_id: roomId, p_index: indice, p_finish: finalizar })
  if (error) throw error
}
