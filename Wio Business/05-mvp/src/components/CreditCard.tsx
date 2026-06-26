import React, { useState } from 'react'

// ── WIO wordmark (from extracted_logo.svg) ────────────────────────────────────
export function WioLogo({ color = '#fff', height = 18 }: { color?: string; height?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 26"
      height={height}
      style={{ fill: color, display: 'block', flexShrink: 0 }}
    >
      <path fillRule="evenodd" d="M36.74 25.134V4.344h4.155v20.79z" clipRule="evenodd" />
      <path
        fillRule="evenodd"
        d="m0 .465 3.1 20.468C3.507 23.62 5.725 25.6 8.328 25.6s4.82-1.977 5.226-4.665L15.66 7.056c.087-.578.563-1.003 1.124-1.003.559 0 1.037.425 1.125 1.003l2.107 13.877c.409 2.69 2.627 4.67 5.23 4.67 2.602 0 4.817-1.975 5.228-4.66l2.329-15.16c.126-.828.81-1.436 1.61-1.436h2.329V0h-2.329C31.571 0 29.15 2.158 28.7 5.093l-2.328 15.159c-.09.578-.566 1.003-1.127 1.003s-1.04-.427-1.127-1.006L22.01 6.373c-.41-2.687-2.625-4.667-5.228-4.667-2.604 0-4.82 1.98-5.228 4.667L9.447 20.252c-.087.578-.563 1.003-1.124 1.003-.558 0-1.037-.425-1.124-1.003L4.207.465z"
        clipRule="evenodd"
      />
      <path d="M53.592 25.579c-3.028 0-5.5-1.176-7.145-3.398-1.394-1.883-2.133-4.447-2.133-7.412s.736-5.525 2.133-7.411c1.644-2.222 4.117-3.398 7.145-3.398s5.5 1.176 7.145 3.398c1.394 1.883 2.133 4.447 2.133 7.411 0 2.965-.736 5.526-2.133 7.412-1.644 2.222-4.117 3.397-7.145 3.397m0-17.866c-1.863 0-3.278.77-4.206 2.023-.886 1.197-1.354 2.938-1.354 5.033s.469 3.836 1.354 5.034c.928 1.253 2.343 2.023 4.206 2.023s3.278-.77 4.207-2.023c.885-1.198 1.353-2.938 1.353-5.034s-.468-3.836-1.353-5.033c-.929-1.254-2.344-2.023-4.207-2.023" />
    </svg>
  )
}

// ── EMV chip — realistic contact pattern ─────────────────────────────────────
function Chip() {
  return (
    <svg width="44" height="34" viewBox="0 0 44 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E4C252" />
          <stop offset="50%" stopColor="#C9A227" />
          <stop offset="100%" stopColor="#A87C10" />
        </linearGradient>
        <linearGradient id="contact" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4AE35" />
          <stop offset="100%" stopColor="#9A7010" />
        </linearGradient>
        <linearGradient id="center" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B89220" />
          <stop offset="100%" stopColor="#8A6C0C" />
        </linearGradient>
      </defs>

      {/* Outer body */}
      <rect width="44" height="34" rx="5" fill="url(#body)" />

      {/* Left column — top contact */}
      <rect x="1.5" y="2" width="13" height="9" rx="1.5" fill="url(#contact)" />
      {/* Left column — middle contact */}
      <rect x="1.5" y="13" width="13" height="8" rx="1.5" fill="url(#contact)" />
      {/* Left column — bottom contact */}
      <rect x="1.5" y="23" width="13" height="9" rx="1.5" fill="url(#contact)" />

      {/* Right column — top contact */}
      <rect x="29.5" y="2" width="13" height="9" rx="1.5" fill="url(#contact)" />
      {/* Right column — middle contact */}
      <rect x="29.5" y="13" width="13" height="8" rx="1.5" fill="url(#contact)" />
      {/* Right column — bottom contact */}
      <rect x="29.5" y="23" width="13" height="9" rx="1.5" fill="url(#contact)" />

      {/* Center vertical ICC bar */}
      <rect x="16" y="0" width="12" height="34" fill="url(#center)" />

      {/* Horizontal score lines */}
      <line x1="16" y1="12" x2="28" y2="12" stroke="#7A5C08" strokeWidth="0.6" opacity="0.7" />
      <line x1="16" y1="22" x2="28" y2="22" stroke="#7A5C08" strokeWidth="0.6" opacity="0.7" />

      {/* Center pad */}
      <rect x="16" y="12" width="12" height="10" fill="#7A5C08" opacity="0.35" />

      {/* Subtle sheen */}
      <rect x="0" y="0" width="44" height="6" rx="5" fill="rgba(255,255,255,0.12)" />
    </svg>
  )
}

// ── VISA wordmark — styled text, matches the real card treatment ──────────────
function VisaWordmark() {
  return (
    <div style={{ textAlign: 'right', lineHeight: 1 }}>
      <div
        style={{
          fontFamily: '"Helvetica Neue", "Arial Black", Arial, sans-serif',
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: 20,
          color: 'rgba(255,255,255,0.96)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        VISA
      </div>
      <div
        style={{
          fontSize: 6,
          letterSpacing: '0.07em',
          color: 'rgba(255,255,255,0.6)',
          marginTop: 3,
          textTransform: 'uppercase',
          fontStyle: 'normal',
          fontWeight: 500,
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
        }}
      >
        Platinum Business
      </div>
    </div>
  )
}

// ── CSS for the 3-D flip ──────────────────────────────────────────────────────
const FLIP_CSS = `
  .fc-wrap { perspective: 1100px; }
  .fc-inner {
    position: absolute; inset: 0;
    transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
  }
  .fc-inner.flipped { transform: rotateY(180deg); }
  .fc-face {
    position: absolute; inset: 0;
    border-radius: 16px;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    overflow: hidden;
  }
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

export function FlipCard({
  gradient,
  label,
  last4,
  holderName,
  limit,
  frozen,
  fmtAED,
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(false)
  const bg = frozen ? 'linear-gradient(135deg, #4B5563 0%, #374151 100%)' : gradient

  return (
    <>
      <style>{FLIP_CSS}</style>
      <div
        className="fc-wrap"
        onMouseEnter={() => setFlipped(true)}
        onMouseLeave={() => setFlipped(false)}
        style={{ userSelect: 'none' }}
      >
        <div className="fc-sizer">
          <div className={`fc-inner${flipped ? ' flipped' : ''}`}>

            {/* ── FRONT ────────────────────────────────────────────────────── */}
            <div
              className="fc-face"
              style={{
                background: bg,
                boxShadow: '0 20px 60px rgba(0,0,0,0.32), 0 4px 16px rgba(0,0,0,0.18)',
                color: '#fff',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              {/* Large WIO watermark — the signature design element */}
              <div
                style={{
                  position: 'absolute',
                  right: -12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  zIndex: 0,
                  opacity: 0.09,
                }}
              >
                <WioLogo color="#fff" height={140} />
              </div>

              {/* Top row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <WioLogo color="rgba(255,255,255,0.90)" height={14} />
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 500,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    opacity: 0.55,
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Chip */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <Chip />
              </div>

              {/* Bottom row */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontSize: 15,
                    letterSpacing: '0.22em',
                    fontWeight: 300,
                    marginBottom: 10,
                    fontFamily: '"Courier New", Courier, monospace',
                    opacity: 0.92,
                  }}
                >
                  •••• •••• •••• {last4}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 7,
                        opacity: 0.5,
                        marginBottom: 3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.14em',
                      }}
                    >
                      Cardholder
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        letterSpacing: '0.06em',
                        opacity: 0.9,
                      }}
                    >
                      {holderName.toUpperCase()}
                    </div>
                  </div>
                  <VisaWordmark />
                </div>
              </div>
            </div>

            {/* ── BACK ─────────────────────────────────────────────────────── */}
            <div
              className="fc-face fc-back"
              style={{
                background: bg,
                boxShadow: '0 20px 60px rgba(0,0,0,0.32), 0 4px 16px rgba(0,0,0,0.18)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                paddingBottom: 20,
              }}
            >
              {/* WIO watermark on back too */}
              <div
                style={{
                  position: 'absolute',
                  right: -12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  zIndex: 0,
                  opacity: 0.06,
                }}
              >
                <WioLogo color="#fff" height={140} />
              </div>

              {/* Mag stripe */}
              <div
                style={{
                  width: '100%',
                  height: 44,
                  background: 'rgba(0,0,0,0.65)',
                  marginTop: 28,
                  position: 'relative',
                  zIndex: 1,
                }}
              />

              {/* Signature strip + CVV */}
              <div
                style={{
                  padding: '0 22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 32,
                    background: 'rgba(255,255,255,0.92)',
                    borderRadius: 4,
                    backgroundImage:
                      'repeating-linear-gradient(90deg, rgba(180,180,180,0.18) 0px, rgba(180,180,180,0.18) 2px, transparent 2px, transparent 8px)',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 10,
                  }}
                >
                  <span
                    style={{
                      color: '#aaa',
                      fontSize: 8,
                      fontStyle: 'italic',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    Authorized Signature
                  </span>
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: 5,
                    padding: '4px 12px',
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: '0.12em',
                    minWidth: 48,
                    textAlign: 'center',
                    fontFamily: '"Courier New", monospace',
                  }}
                >
                  {frozen ? '—' : '• • •'}
                </div>
              </div>

              {/* Bottom info */}
              <div
                style={{
                  padding: '0 22px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 7,
                      opacity: 0.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                      marginBottom: 3,
                    }}
                  >
                    Spend limit
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.9 }}>
                    {limit ? fmtAED(limit) : '—'}
                  </div>
                </div>
                <WioLogo color="rgba(255,255,255,0.35)" height={11} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
