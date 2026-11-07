import { supabase } from '../lib/supabase'

async function garantirSessao() {
  if (!supabase) throw new Error('Configure as variáveis do Supabase no arquivo .env.')
  const { data: { session }, error: sessaoErro } = await supabase.auth.getSession()
  if (sessaoErro) throw sessaoErro
  if (session?.user) return session.user

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.user
}

export async function criarSala(nome) {
  await garantirSessao()
  const { data, error } = await supabase.rpc('create_room', { p_player_name: nome.trim() })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function entrarSala(codigo, nome) {
  await garantirSessao()
  const { data, error } = await supabase.rpc('join_room', {
    p_room_code: codigo.trim().toUpperCase(),
    p_player_name: nome.trim(),
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function buscarSala(roomId) {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, status, host_user_id, created_at')
    .eq('id', roomId)
    .single()
  if (error) throw error
  return data
}

export async function listarJogadores(roomId) {
  const { data, error } = await supabase
    .from('room_players')
    .select('id, user_id, player_name, is_host, joined_at')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export async function iniciarSala(roomId) {
  const { error } = await supabase.rpc('start_room', { p_room_id: roomId })
  if (error) throw error
}

export function observarSala(roomId, aoMudar) {
  const canal = supabase
    .channel(`room-${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, aoMudar)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, aoMudar)
    .subscribe()

  return () => supabase.removeChannel(canal)
}

export async function sairSala(roomId) {
  const { error } = await supabase.rpc('leave_room', { p_room_id: roomId })
  if (error) throw error
}
