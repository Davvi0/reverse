
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const REACTIONS = [
  { emoji: '😂', label: 'Muito engraçado' },
  { emoji: '💀', label: 'Não acredito' },
  { emoji: '🔥', label: 'Mandou bem' },
  { emoji: '👏', label: 'Aplausos' },
  { emoji: '😱', label: 'Surpresa' },
]

const VALID = new Set(REACTIONS.map(x => x.emoji))

export default function LiveReactions({
  roomId,
  userId,
  name,
  enabled = true,
}) {
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(false)
  const [cooldown, setCooldown] = useState(false)
  const [open, setOpen] = useState(false)

  const channelRef = useRef(null)
  const lastSent = useRef(0)
  const containerRef = useRef(null)

  const show = useCallback((event) => {
    if (
      !event ||
      !VALID.has(event.emoji) ||
      typeof event.name !== 'string'
    ) return

    const item = {
      id: `${Date.now()}-${Math.random()}`,
      emoji: event.emoji,
      name: event.name.slice(0, 24),
      mine: event.userId === userId,
      createdAt: Date.now(),
    }

    setEvents(prev => [...prev.slice(-4), item])
  }, [userId])

  // Reações sincronizadas entre jogadores
  useEffect(() => {
    if (!roomId) {
      setConnected(false)
      return
    }

    const channel = supabase.channel(
      `reverse-live-reactions-${roomId}`,
      {
        config: {
          broadcast: {
            self: false,
          },
        },
      }
    )

    channelRef.current = channel

    channel.on(
      'broadcast',
      { event: 'reaction' },
      ({ payload }) => show(payload)
    )

    channel.subscribe(status => {
      setConnected(status === 'SUBSCRIBED')
    })

    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [roomId, show])

  // Remove as reações após alguns segundos
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()

      setEvents(prev =>
        prev.some(e => now - e.createdAt > 4200)
          ? prev.filter(e => now - e.createdAt <= 4200)
          : prev
      )

      if (now - lastSent.current >= 800) {
        setCooldown(false)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [])

  // Fecha o menu ao clicar fora
  useEffect(() => {
    if (!open) return

    function handleOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  async function react(emoji) {
    if (
      !enabled ||
      !connected ||
      cooldown ||
      Date.now() - lastSent.current < 800
    ) return

    lastSent.current = Date.now()
    setCooldown(true)
    setOpen(false)

    const payload = {
      emoji,
      name: name || 'Jogador',
      userId,
    }

    show(payload)

    try {
      await channelRef.current?.send({
        type: 'broadcast',
        event: 'reaction',
        payload,
      })
    } catch (error) {
      console.error('Erro ao enviar reação:', error)
    }
  }

  return (
    <>
      <style>{`
        /* =====================================
           REVERSE — REAÇÕES COMPACTAS
           Posicionamento normal na página
        ===================================== */

        .rc-floating {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-end;

          width: 100%;
          min-height: 62px;
          margin: 24px 0 12px;
          padding: 0;

          z-index: 20;
          font-family: inherit;
        }

        /* Botão circular */

        .rc-floating-toggle {
          position: relative;

          width: 56px;
          height: 56px;
          flex-shrink: 0;

          display: flex;
          align-items: center;
          justify-content: center;

          border: 1px solid rgba(255,255,255,.14);
          border-radius: 50%;

          background: #24242c;
          color: #fff;

          font-size: 26px;
          line-height: 1;
          cursor: pointer;

          box-shadow:
            0 8px 24px rgba(0,0,0,.28),
            inset 0 1px rgba(255,255,255,.07);

          transition:
            background .2s ease,
            border-color .2s ease,
            transform .2s ease;
        }

        .rc-floating-toggle:hover {
          background: #30303a;
          border-color: #ff713d;
          transform: scale(1.05);
        }

        .rc-floating-toggle:active {
          transform: scale(.95);
        }

        .rc-floating-toggle.open {
          background: #ff713d;
          border-color: #ff713d;
          color: #151515;
        }

        .rc-floating-toggle:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        /* Indicador de conexão */

        .rc-floating-status {
          position: absolute;
          right: 1px;
          bottom: 1px;

          width: 13px;
          height: 13px;

          border: 3px solid #24242c;
          border-radius: 50%;
          background: #777782;
        }

        .rc-floating-status.online {
          background: #4ade80;
        }

        /* Menu expandido */

        .rc-floating-menu {
          position: absolute;
          right: 0;
          bottom: calc(100% + 12px);

          display: flex;
          align-items: center;
          gap: 5px;

          padding: 9px;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 50px;

          background: #202028;

          box-shadow:
            0 14px 35px rgba(0,0,0,.38),
            inset 0 1px rgba(255,255,255,.05);

          animation: rc-menu-in .2s ease-out both;
        }

        .rc-floating-emoji {
          display: flex;
          align-items: center;
          justify-content: center;

          width: 42px;
          height: 42px;
          flex-shrink: 0;

          border: 0;
          border-radius: 50%;
          background: transparent;

          font-size: 25px;
          cursor: pointer;

          transition:
            transform .2s ease,
            background .2s ease;
        }

        .rc-floating-emoji:hover {
          background: rgba(255,255,255,.09);
          transform: scale(1.18);
        }

        .rc-floating-emoji:active {
          transform: scale(.94);
        }

        .rc-floating-emoji:disabled {
          opacity: .4;
          cursor: not-allowed;
        }

        .rc-floating-toggle:focus-visible,
        .rc-floating-emoji:focus-visible {
          outline: 2px solid #ff9a67;
          outline-offset: 3px;
        }

        @keyframes rc-menu-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(.94);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Reações recebidas */

        .rc-floating-stream {
          position: absolute;
          right: 0;
          bottom: calc(100% + 12px);

          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 7px;

          width: 240px;
          pointer-events: none;
        }

        .rc-floating-stream.menu-open {
          bottom: calc(100% + 82px);
        }

        .rc-floating-event {
          display: flex;
          align-items: center;
          gap: 9px;

          max-width: 100%;
          padding: 9px 12px;

          border: 1px solid rgba(255,255,255,.1);
          border-radius: 14px;

          background: rgba(29,29,37,.97);
          color: #f5f5f7;

          font-size: 12px;
          font-weight: 600;

          box-shadow: 0 8px 24px rgba(0,0,0,.28);

          animation: rc-event-in .3s ease both;
        }

        .rc-floating-event-emoji {
          font-size: 23px;
          line-height: 1;
        }

        .rc-floating-event-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @keyframes rc-event-in {
          from {
            opacity: 0;
            transform: translateY(12px) scale(.9);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Responsivo */

        @media (max-width: 480px) {
          .rc-floating {
            margin-top: 20px;
            margin-bottom: 10px;
            min-height: 54px;
          }

          .rc-floating-toggle {
            width: 52px;
            height: 52px;
            font-size: 24px;
          }

          .rc-floating-menu {
            gap: 3px;
            padding: 7px;
          }

          .rc-floating-emoji {
            width: 37px;
            height: 37px;
            font-size: 22px;
          }

          .rc-floating-stream {
            width: 215px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rc-floating-menu,
          .rc-floating-event {
            animation: none;
          }

          .rc-floating-toggle,
          .rc-floating-emoji {
            transition: none;
          }
        }
      `}</style>

      <aside
        className="rc-floating"
        ref={containerRef}
        aria-label="Reações ao vivo"
      >
        {/* Reações enviadas pelos jogadores */}
        <div
          className={`rc-floating-stream ${
            open ? 'menu-open' : ''
          }`}
          aria-live="polite"
          aria-relevant="additions"
        >
          {events.map(event => (
            <div
              className="rc-floating-event"
              key={event.id}
            >
              <span
                className="rc-floating-event-emoji"
                aria-hidden="true"
              >
                {event.emoji}
              </span>

              <span className="rc-floating-event-name">
                {event.mine ? 'Você' : event.name}
              </span>
            </div>
          ))}
        </div>

        {/* Menu de emojis */}
        {open && (
          <div
            className="rc-floating-menu"
            aria-label="Escolher reação"
          >
            {REACTIONS.map(item => (
              <button
                key={item.emoji}
                type="button"
                className="rc-floating-emoji"
                title={item.label}
                aria-label={item.label}
                disabled={!enabled || !connected || cooldown}
                onClick={() => react(item.emoji)}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        )}

        {/* Botão principal */}
        <button
          type="button"
          className={`rc-floating-toggle ${
            open ? 'open' : ''
          }`}
          onClick={() => setOpen(prev => !prev)}
          disabled={!enabled}
          aria-label={
            open ? 'Fechar reações' : 'Abrir reações'
          }
          aria-expanded={open}
        >
          <span aria-hidden="true">
            {open ? '×' : '😊'}
          </span>

          <span
            className={`rc-floating-status ${
              connected ? 'online' : ''
            }`}
          />
        </button>
      </aside>
    </>
  )
}
