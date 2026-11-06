const ICONES = {
  play: ['M8 5v14l11-7z', true],
  pause: ['M6 5h4v14H6zM14 5h4v14h-4z', true],
  stop: ['M6 6h12v12H6z', true],
  replay: ['M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5'],
  mic: ['M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3'],
  arrow: ['M5 12h14M13 6l6 6-6 6'],
  back: ['M19 12H5M11 6l-6 6 6 6'],
  check: ['M20 6 9 17l-5-5'],
  shuffle: ['M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5'],
  lock: ['M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z'],
  phones: ['M3 14v-2a9 9 0 0 1 18 0v2M3 14h3v6H5a2 2 0 0 1-2-2zM21 14h-3v6h1a2 2 0 0 0 2-2z'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  star: ['m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
}

export default function Ico({ n, className = 'size-5' }) {
  const [d, cheio] = ICONES[n]
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill={cheio ? 'currentColor' : 'none'}
      stroke={cheio ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}
