/** Synthetic street scene used as the "camera feed" (no real photos, no uploads). Zoom/origin simulate moving closer. */
export function EvidenceScene({ scale = 1, ox = 50, oy = 50, className = '' }: { scale?: number; ox?: number; oy?: number; className?: string }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={`h-full w-full transition-transform duration-700 ease-out ${className}`} style={{ transform: `scale(${scale})`, transformOrigin: `${ox}% ${oy}%` }} role="img" aria-label="Synthetic street scene with a damaged car">
      <rect width="400" height="300" fill="#DCE6F5" />
      <rect y="190" width="400" height="110" fill="#8A94A6" />
      <rect y="186" width="400" height="8" fill="#C9D3EC" />
      {[20, 120, 220, 320].map((x) => <rect key={x} x={x} y="248" width="50" height="6" rx="2" fill="#F5F7FA" />)}
      <rect x="338" y="96" width="5" height="96" fill="#61718C" />
      <rect x="318" y="62" width="46" height="40" rx="5" fill="#1A4F99" />
      <text x="341" y="88" textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff">P</text>
      <rect x="60" y="130" width="230" height="62" rx="16" fill="#3A5ECF" />
      <path d="M100 130 L130 96 H230 L262 130 Z" fill="#2F4CC4" />
      <path d="M112 128 L136 102 H178 V128 Z M186 128 V102 H226 L250 128 Z" fill="#EAF0FC" />
      <circle cx="108" cy="194" r="24" fill="#1D2943" /><circle cx="108" cy="194" r="11" fill="#C9D3EC" />
      <circle cx="244" cy="194" r="24" fill="#1D2943" /><circle cx="244" cy="194" r="11" fill="#C9D3EC" />
      <rect x="276" y="148" width="14" height="10" rx="3" fill="#FFF3B0" />
      {/* dent + scratches */}
      <g stroke="#B42318" strokeWidth="2.5" strokeLinecap="round" fill="none"><path d="M196 150 l22 10 M200 160 l26 6 M192 166 l20 4" /></g>
      <ellipse cx="208" cy="158" rx="22" ry="12" fill="#1D2943" opacity=".18" />
      {/* plate */}
      <rect x="74" y="168" width="44" height="16" rx="3" fill="#fff" stroke="#1D2943" strokeWidth="1.5" />
      <text x="96" y="180" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1D2943">粤B ***8</text>
    </svg>
  );
}
