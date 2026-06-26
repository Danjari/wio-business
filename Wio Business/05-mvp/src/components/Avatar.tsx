import React, { useMemo } from 'react'
import { createAvatar } from '@dicebear/core'
import * as loreleiNeutral from '@dicebear/lorelei-neutral'

type AvatarProps = {
  seed: string
  size?: number
  style?: React.CSSProperties
}

export default function Avatar({ seed, size = 36, style }: AvatarProps) {
  const svg = useMemo(
    () => createAvatar(loreleiNeutral, { seed, size, backgroundColor: ['eff1f5'] }).toString(),
    [seed, size],
  )

  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'inline-block',
        ...style,
      }}
    />
  )
}
