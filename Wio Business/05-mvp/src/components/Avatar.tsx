import React from 'react'

type AvatarProps = {
  seed: string
  size?: number
  style?: React.CSSProperties
}

export default function Avatar({ seed, size = 36, style }: AvatarProps) {
  const url =
    `https://api.dicebear.com/10.x/lorelei-neutral/svg` +
    `?seed=${encodeURIComponent(seed)}` +
    `&backgroundColor=f0f0f0` +
    `&scale=85` +
    `&radius=50`
  return (
    <img
      src={url}
      alt={seed}
      width={size}
      height={size}
      style={{ borderRadius: '50%', display: 'block', flexShrink: 0, background: '#f0f0f0', ...style }}
    />
  )
}
