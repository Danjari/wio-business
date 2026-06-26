import React, { useState } from 'react'

export function WioLogo({ color = '#fff', height = 18 }: { color?: string; height?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 26" height={height} style={{ fill: color, display: 'block' }}>
      <path fillRule="evenodd" d="M36.74 25.134V4.344h4.155v20.79z" clipRule="evenodd" />
      <path fillRule="evenodd" d="m0 .465 3.1 20.468C3.507 23.62 5.725 25.6 8.328 25.6s4.82-1.977 5.226-4.665L15.66 7.056c.087-.578.563-1.003 1.124-1.003.559 0 1.037.425 1.125 1.003l2.107 13.877c.409 2.69 2.627 4.67 5.23 4.67 2.602 0 4.817-1.975 5.228-4.66l2.329-15.16c.126-.828.81-1.436 1.61-1.436h2.329V0h-2.329C31.571 0 29.15 2.158 28.7 5.093l-2.328 15.159c-.09.578-.566 1.003-1.127 1.003s-1.04-.427-1.127-1.006L22.01 6.373c-.41-2.687-2.625-4.667-5.228-4.667-2.604 0-4.82 1.98-5.228 4.667L9.447 20.252c-.087.578-.563 1.003-1.124 1.003-.558 0-1.037-.425-1.124-1.003L4.207.465z" clipRule="evenodd" />
      <path d="M53.592 25.579c-3.028 0-5.5-1.176-7.145-3.398-1.394-1.883-2.133-4.447-2.133-7.412s.736-5.525 2.133-7.411c1.644-2.222 4.117-3.398 7.145-3.398s5.5 1.176 7.145 3.398c1.394 1.883 2.133 4.447 2.133 7.411 0 2.965-.736 5.526-2.133 7.412-1.644 2.222-4.117 3.397-7.145 3.397m0-17.866c-1.863 0-3.278.77-4.206 2.023-.886 1.197-1.354 2.938-1.354 5.033s.469 3.836 1.354 5.034c.928 1.253 2.343 2.023 4.206 2.023s3.278-.77 4.207-2.023c.885-1.198 1.353-2.938 1.353-5.034s-.468-3.836-1.353-5.033c-.929-1.254-2.344-2.023-4.207-2.023" />
    </svg>
  )
}

function Chip() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
      <rect x="0.5" y="0.5" width="35" height="27" rx="3.5" fill="#D4AF37" stroke="#B8962E" />
      <rect x="13" y="0.5" width="10" height="27" fill="#C9A227" stroke="#B8962E" strokeWidth="0.5" />
      <rect x="0.5" y="9" width="35" height="10" fill="#C9A227" stroke="#B8962E" strokeWidth="0.5" />
      <rect x="13" y="9" width="10" height="10" fill="#B8962E" />
    </svg>
  )
}

function VisaMark() {
  return (
    <svg viewBox="0 0 750 471" height="20" fill="none">
      <path d="M278.2 334.9l45-278.5H396l-45 278.5H278.2z" fill="white" />
      <path d="M524.3 61.4c-17.9-6.7-46-13.9-81.1-13.9-89.4 0-152.4 47.5-152.8 115.5-.4 50.3 44.9 78.4 79.2 95.1 35.2 17.1 47 28 46.8 43.2-.2 23.3-28.1 34-54.1 34-36.2 0-55.4-5.3-85.1-18.4l-11.7-5.6-12.7 78.5c21.1 9.8 60.2 18.3 100.7 18.7 95 0 156.7-46.9 157.4-119.6.3-39.8-23.7-70.1-75.8-95.1-31.6-16.2-50.9-27-50.7-43.4.1-14.5 16.4-30.1 51.8-30.1 29.6-.5 51 6.3 67.6 13.3l8.1 4 12.4-76.2z" fill="white" />
      <path d="M657.3 56.4H579c-24.1 0-42.1 7-52.7 32.4l-149.5 358.7h105.7s17.3-48.1 21.2-58.6l128.9.1c3 13.6 12.2 58.5 12.2 58.5H745L657.3 56.4zM533.9 317.5c8.3-22.4 40-108.6 40-108.6-.6 1-8.2-22.4-13.3-37l-9 32.5-17.7 113.1z" fill="white" />
      <path d="M240.2 56.4l-88.5 190.4-9.4-48.4C126.8 143 90.3 95.2 49.4 72.1l81 262.8 106.2-.1L343.7 56.4H240.2z" fill="white" />
      <path d="M104.4 56.4H0.6L0 61.8c80.5 20.6 133.8 70.3 155.9 130l-22.5-114.3c-3.9-25-21.5-20.6-29-21.1z" fill="#F2AE14" />
    </svg>
  )
}

const FLIP_STYLES = `
  .fc-wrap { perspective: 1000px; }
  .fc-inner { transition: transform 0.55s cubic-bezier(0.4,0.2,0.2,1); transform-style: preserve-3d; position: relative; width: 100%; }
  .fc-inner.is-flipped { transform: rotateY(180deg); }
  .fc-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 14px; overflow: hidden; position: absolute; inset: 0; }
  .fc-back { transform: rotateY(180deg); }
  .fc-sizer { width: 100%; padding-bottom: 62.5%; position: relative; }
`

export type FlipCardProps = {
  gradient: string
  label: string
  last4: string
  holderName: string
  limit?: number
  frozen?: boolean
  fmtAED: (n: number) => string
}

export function FlipCard({ gradient, label, last4, holderName, limit, frozen, fmtAED }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false)
  const bg = frozen ? 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)' : gradient

  return (
    <>
      <style>{FLIP_STYLES}</style>
      <div
        className="fc-wrap"
        onMouseEnter={() => setFlipped(true)}
        onMouseLeave={() => setFlipped(false)}
        style={{ userSelect: 'none', cursor: 'default' }}
      >
        <div className="fc-sizer">
          <div className={`fc-inner${flipped ? ' is-flipped' : ''}`} style={{ position: 'absolute', inset: 0 }}>

            {/* FRONT */}
            <div className="fc-face" style={{
              background: bg, color: '#fff',
              padding: '18px 20px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
            }}>
              <div style={{ position: 'absolute', top: -44, right: -44, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -24, left: 24, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                <WioLogo color="rgba(255,255,255,0.92)" height={15} />
                <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.65, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</div>
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <Chip />
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 14, letterSpacing: '0.22em', fontWeight: 300, marginBottom: 10, fontFamily: 'monospace', opacity: 0.9 }}>
                  •••• •••• •••• {last4}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 7, opacity: 0.55, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Cardholder</div>
                    <div style={{ fontSize: 11, fontWeight: 400, letterSpacing: '0.04em' }}>{holderName.toUpperCase()}</div>
                  </div>
                  <VisaMark />
                </div>
              </div>
            </div>

            {/* BACK */}
            <div className="fc-face fc-back" style={{
              background: bg, color: '#fff',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
            }}>
              <div style={{ width: '100%', height: 42, background: 'rgba(0,0,0,0.55)', marginTop: 22 }} />

              <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1, height: 30, background: 'rgba(255,255,255,0.88)', borderRadius: 4,
                  display: 'flex', alignItems: 'center', paddingLeft: 10,
                }}>
                  <span style={{ color: '#aaa', fontSize: 9, fontStyle: 'italic' }}>Authorized signature</span>
                </div>
                <div style={{
                  background: '#fff', color: '#333', borderRadius: 4,
                  padding: '4px 10px', fontSize: 13, fontWeight: 500,
                  letterSpacing: '0.1em', minWidth: 40, textAlign: 'center',
                }}>
                  {frozen ? '—' : '•••'}
                </div>
              </div>

              <div style={{ padding: '0 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 7, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>Limit</div>
                  <div style={{ fontSize: 11, fontWeight: 400 }}>{limit ? fmtAED(limit) : '—'}</div>
                </div>
                <WioLogo color="rgba(255,255,255,0.45)" height={12} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
