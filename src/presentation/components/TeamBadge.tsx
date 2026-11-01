import React, { useState } from 'react';
import { Shield } from 'lucide-react';

interface TeamBadgeProps {
  name: string;
  badgeUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: { container: 'w-5 h-5 text-[9px]', icon: 'w-3.5 h-3.5', img: 'w-5 h-5' },
  sm: { container: 'w-6 h-6 text-[10px]', icon: 'w-4 h-4', img: 'w-6 h-6' },
  md: { container: 'w-8 h-8 text-xs', icon: 'w-5 h-5', img: 'w-8 h-8' },
  lg: { container: 'w-11 h-11 text-sm font-bold', icon: 'w-7 h-7', img: 'w-11 h-11' },
  xl: { container: 'w-14 h-14 text-base font-black', icon: 'w-9 h-9', img: 'w-14 h-14' },
};

// Generador de color determinista a partir del nombre del equipo
function getTeamColor(name: string): { bg: string; text: string; border: string } {
  const colors = [
    { bg: 'from-blue-700 to-indigo-900', text: 'text-white', border: 'border-blue-400' },
    { bg: 'from-red-600 to-rose-900', text: 'text-white', border: 'border-red-400' },
    { bg: 'from-amber-500 to-yellow-700', text: 'text-slate-950 font-black', border: 'border-amber-300' },
    { bg: 'from-emerald-600 to-teal-900', text: 'text-white', border: 'border-emerald-400' },
    { bg: 'from-purple-600 to-violet-900', text: 'text-white', border: 'border-purple-400' },
    { bg: 'from-sky-500 to-blue-800', text: 'text-white', border: 'border-sky-300' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % colors.length;
  return colors[idx];
}

// Obtener 2 iniciales representativas del nombre del equipo
function getTeamInitials(name: string): string {
  if (!name) return 'FC';
  const clean = name
    .replace(/"[^"]*"/g, '') // Quitar comillas como "A", "B", "VERDE"
    .replace(/\b(de|del|la|las|los|y|el|san|santa|colegio)\b/gi, '')
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export const TeamBadge: React.FC<TeamBadgeProps> = ({
  name,
  badgeUrl,
  size = 'md',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const teamColor = getTeamColor(name);
  const initials = getTeamInitials(name);

  if (badgeUrl && !hasError) {
    return (
      <img
        src={badgeUrl}
        alt={name}
        onError={() => setHasError(true)}
        className={`${sizeConfig.img} object-contain flex-shrink-0 drop-shadow-sm ${className}`}
        loading="lazy"
      />
    );
  }

  // Fallback Heráldico Elegante: Escudo con degradado de color e iniciales de club
  return (
    <div
      title={name}
      className={`relative flex items-center justify-center rounded-lg bg-gradient-to-br ${teamColor.bg} border ${teamColor.border} shadow-sm flex-shrink-0 select-none ${sizeConfig.container} ${className}`}
    >
      <Shield className={`absolute opacity-20 text-white pointer-events-none ${sizeConfig.icon}`} />
      <span className={`relative z-10 font-bold uppercase tracking-tighter ${teamColor.text}`}>
        {initials}
      </span>
    </div>
  );
};

