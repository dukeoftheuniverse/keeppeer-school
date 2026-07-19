import React from 'react';
import { Star, CheckCircle, Trophy, Flame, BookOpen } from 'lucide-react';

export const BADGE_TYPES = {
  student_achievement: {
    label: 'Student Achievement',
    short: 'STUDENT ACHIEVEMENT',
    icon: Star,
    bannerColor: '#1a237e',
    leftRibbon: '#d32f2f',
    rightRibbon: '#1976d2',
    iconColor: '#FFD700',
  },
  perfect_attendance: {
    label: 'Perfect Attendance',
    short: 'PERFECT ATTENDANCE',
    icon: CheckCircle,
    bannerColor: '#1a237e',
    leftRibbon: '#2e7d32',
    rightRibbon: '#f9a825',
    iconColor: '#43A047',
  },
  excellence: {
    label: 'Excellence',
    short: 'EXCELLENCE',
    icon: Trophy,
    bannerColor: '#1a237e',
    leftRibbon: '#d32f2f',
    rightRibbon: '#1976d2',
    iconColor: '#FFD700',
  },
  leadership: {
    label: 'Leadership',
    short: 'LEADERSHIP',
    icon: Flame,
    bannerColor: '#1b5e20',
    leftRibbon: '#2e7d32',
    rightRibbon: '#f9a825',
    iconColor: '#FF6F00',
  },
  honor_roll: {
    label: 'Honor Roll',
    short: 'HONOR ROLL',
    icon: BookOpen,
    bannerColor: '#4a148c',
    leftRibbon: '#f9a825',
    rightRibbon: '#7b1fa2',
    iconColor: '#1565C0',
  },
};

export default function BadgeMedal({ type, size = 120, showLabel = true }) {
  const cfg = BADGE_TYPES[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const w = size;
  const h = size * 1.18;

  return (
    <div className="inline-flex flex-col items-center" style={{ width: w }}>
      <svg width={w} height={h} viewBox="0 0 120 142" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`gold-${type}`} cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#FFF6B0" />
            <stop offset="35%" stopColor="#FFD700" />
            <stop offset="70%" stopColor="#FBC02D" />
            <stop offset="100%" stopColor="#B8860B" />
          </radialGradient>
          <radialGradient id={`inner-${type}`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#FFE45C" />
            <stop offset="55%" stopColor="#E8B923" />
            <stop offset="100%" stopColor="#9E7A0F" />
          </radialGradient>
          <linearGradient id={`banner-${type}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cfg.bannerColor} />
            <stop offset="100%" stopColor={cfg.bannerColor} stopOpacity="0.82" />
          </linearGradient>
        </defs>

        {/* Ribbon tails */}
        <polygon points="32,82 18,82 26,120 40,108" fill={cfg.leftRibbon} />
        <polygon points="88,82 102,82 94,120 80,108" fill={cfg.rightRibbon} />
        <polygon points="32,82 26,120 33,112 40,108" fill="#000" opacity="0.18" />
        <polygon points="88,82 94,120 87,112 80,108" fill="#000" opacity="0.18" />

        {/* Outer medallion (laurel ring) */}
        <circle cx="60" cy="58" r="50" fill={`url(#gold-${type})`} />
        <circle cx="60" cy="58" r="50" fill="none" stroke="#8B6914" strokeWidth="1.2" opacity="0.5" />
        {/* Laurel decorative dots */}
        {Array.from({ length: 28 }).map((_, i) => {
          const a = (i / 28) * Math.PI * 2;
          const r = 45;
          return <circle key={i} cx={60 + r * Math.cos(a)} cy={58 + r * Math.sin(a)} r="1.6" fill="#8B6914" opacity="0.55" />;
        })}
        {/* Embossed stars background */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2 + 0.2;
          const r = 34;
          return <text key={i} x={60 + r * Math.cos(a)} y={62 + r * Math.sin(a)} fontSize="7" fill="#B8860B" opacity="0.3" textAnchor="middle">✦</text>;
        })}

        {/* Inner circle */}
        <circle cx="60" cy="58" r="36" fill={`url(#inner-${type})`} />
        <circle cx="60" cy="58" r="36" fill="none" stroke="#7A5A0E" strokeWidth="1" opacity="0.6" />

        {/* Central icon */}
        <g transform="translate(60,58)">
          <g transform="translate(-18,-18)">
            <Icon size={36} color={cfg.iconColor} strokeWidth={1.6} fill={type === 'student_achievement' || type === 'excellence' ? cfg.iconColor : 'none'} />
          </g>
        </g>

        {/* Sparkles for achievement */}
        {type === 'student_achievement' && (
          <>
            <text x="30" y="34" fontSize="6" fill="#FFF" opacity="0.9">✦</text>
            <text x="84" y="40" fontSize="5" fill="#FFF" opacity="0.8">✦</text>
            <text x="32" y="84" fontSize="5" fill="#FFF" opacity="0.7">✦</text>
          </>
        )}

        {/* Banner ribbon */}
        <g>
          <rect x="20" y="76" width="80" height="20" rx="3" fill={`url(#banner-${type})`} />
          <rect x="20" y="76" width="80" height="3" fill="#fff" opacity="0.18" />
          <rect x="20" y="93" width="80" height="3" fill="#000" opacity="0.18" />
          {/* Banner end notches */}
          <polygon points="20,76 20,96 12,86" fill={cfg.bannerColor} />
          <polygon points="100,76 100,96 108,86" fill={cfg.bannerColor} />
        </g>
        <text x="60" y="90" fontSize="7.5" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="0.5" fontFamily="Inter, sans-serif">
          {cfg.short}
        </text>
      </svg>
      {showLabel && <span className="text-[10px] font-semibold text-[#004D40] mt-0.5 text-center leading-tight">{cfg.label}</span>}
    </div>
  );
}