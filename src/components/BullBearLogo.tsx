import React from 'react';

interface BullBearLogoProps {
  className?: string;
  size?: number;
}

export const BullBearLogo: React.FC<BullBearLogoProps> = ({ className = '', size = 52 }) => {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center shrink-0 border-2 border-amber-500/50 hover:border-amber-400 transition-all ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: 'radial-gradient(circle at 50% 30%, #1e1b4b 0%, #090d16 100%)'
      }}
      title="StockSignalPl - Byk (Hossa) & Niedźwiedź (Bessa)"
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full p-0.5"
      >
        <defs>
          {/* Dynamic Glow Filter */}
          <filter id="bullGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#10b981" floodOpacity="0.6"/>
          </filter>
          <filter id="bearGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#f43f5e" floodOpacity="0.6"/>
          </filter>

          {/* Bull Vibrant Green Gradient */}
          <linearGradient id="bullGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          {/* Bear Vibrant Red Gradient */}
          <linearGradient id="bearGrad" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fda4af" />
            <stop offset="50%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>

          {/* Gold Lightning Bolt Gradient */}
          <linearGradient id="goldLightning" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>

        {/* Outer Tech Ring */}
        <circle cx="60" cy="60" r="56" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

        {/* LEFT: THE CHARGING BULL (HOSSA) - Large & Bold */}
        <g filter="url(#bullGlow)">
          {/* Bull Horn */}
          <path
            d="M32 20 C24 8, 12 12, 14 30 C16 38, 26 34, 30 28 Z"
            fill="url(#bullGrad)"
            stroke="#a7f3d0"
            strokeWidth="0.8"
          />
          {/* Bull Head & Muscle */}
          <path
            d="M28 28 L46 32 L54 50 L44 68 L28 66 L18 52 L20 38 Z"
            fill="url(#bullGrad)"
          />
          {/* Bull Snout */}
          <path
            d="M18 52 L10 56 L12 68 L28 66 Z"
            fill="#059669"
          />
          {/* Bull Nostril */}
          <circle cx="16" cy="62" r="2" fill="#022c22" />
          {/* Bull Eye */}
          <polygon points="32,42 40,44 34,48" fill="#ffffff" />
          <circle cx="35" cy="45" r="1.5" fill="#022c22" />
          {/* Bull Shoulder/Chest */}
          <path
            d="M44 68 L50 86 L32 94 L22 84 L28 66 Z"
            fill="#047857"
          />
        </g>

        {/* RIGHT: THE ROARING BEAR (BESSA) - Large & Bold */}
        <g filter="url(#bearGlow)">
          {/* Bear Ear */}
          <path
            d="M86 18 C94 12, 102 18, 98 30 C94 36, 88 32, 86 26 Z"
            fill="url(#bearGrad)"
            stroke="#fecdd3"
            strokeWidth="0.8"
          />
          {/* Bear Forehead & Skull */}
          <path
            d="M88 26 L72 32 L66 50 L76 68 L92 66 L102 52 L98 36 Z"
            fill="url(#bearGrad)"
          />
          {/* Bear Open Muzzle / Snout */}
          <path
            d="M102 52 L110 58 L106 68 L92 66 Z"
            fill="#be123c"
          />
          {/* Bear Sharp Fangs / Teeth */}
          <polygon points="102,60 106,62 102,65" fill="#ffffff" />
          {/* Bear Eye */}
          <polygon points="86,42 78,44 84,48" fill="#ffffff" />
          <circle cx="82" cy="45" r="1.5" fill="#4c0519" />
          {/* Bear Powerful Neck/Back */}
          <path
            d="M76 68 L70 86 L88 94 L98 84 L92 66 Z"
            fill="#9f1239"
          />
        </g>

        {/* CENTER: THE GOLD VOLTAGE DIVIDER (LIGHTNING) */}
        <path
          d="M62 6 L53 54 L66 58 L56 114 L65 58 L52 54 Z"
          fill="url(#goldLightning)"
          stroke="#fef08a"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Bottom Spark/Glow */}
        <circle cx="60" cy="60" r="3" fill="#ffffff" />
      </svg>
    </div>
  );
};
