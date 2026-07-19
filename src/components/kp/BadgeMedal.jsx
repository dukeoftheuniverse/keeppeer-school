import React from 'react';
import { Star, CheckCheck, Trophy, Flame, BookOpen } from 'lucide-react';

export const BADGES = [
  { type: 'student_achievement', label: 'Student Achievement', Icon: Star, banner: '#0D47A1', ribbonA: '#F44336', ribbonB: '#0D47A1', iconColor: '#F5E080' },
  { type: 'perfect_attendance', label: 'Perfect Attendance', Icon: CheckCheck, banner: '#0D47A1', ribbonA: '#4CAF50', ribbonB: '#FFC107', iconColor: '#4CAF50' },
  { type: 'excellence', label: 'Excellence', Icon: Trophy, banner: '#0D47A1', ribbonA: '#F44336', ribbonB: '#0D47A1', iconColor: '#F5E080' },
  { type: 'leadership', label: 'Leadership', Icon: Flame, banner: '#4CAF50', ribbonA: '#4CAF50', ribbonB: '#FFC107', iconColor: '#F5E080' },
  { type: 'honor_roll', label: 'Honor Roll', Icon: BookOpen, banner: '#6A1B9A', ribbonA: '#FFC107', ribbonB: '#6A1B9A', iconColor: '#F5E080' },
];

export function getBadge(type) { return BADGES.find(b => b.type === type) || BADGES[0]; }

export default function BadgeMedal({ type, size = 80, showLabel = true }) {
  const b = getBadge(type);
  const { Icon, banner, ribbonA, ribbonB, iconColor } = b;
  return (
    <div className="inline-flex flex-col items-center select-none" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size * 1.35 }}>
        {/* Ribbons */}
        <div className="absolute left-1/2 -translate-x-[14px] bottom-0" style={{ width: 14, height: size * 0.42, background: ribbonA, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)' }} />
        <div className="absolute left-1/2 translate-x-0 bottom-0" style={{ width: 14, height: size * 0.42, background: ribbonB, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)' }} />
        {/* Medal */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 0, width: size, height: size }}>
          <div className="w-full h-full rounded-full flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle at 35% 30%, #F5E080 0%, #D4AF37 45%, #B8860B 100%)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -3px 6px rgba(120,90,10,0.5), 0 3px 8px rgba(0,0,0,0.25)',
              border: '2px solid #C5A020',
            }}>
            {/* Laurel ring */}
            <div className="absolute inset-1 rounded-full border-2 border-[#E6C200]/70" />
            <div className="absolute inset-2 rounded-full" style={{ border: '1.5px dashed rgba(255,255,255,0.45)' }} />
            {/* Icon */}
            <Icon className="relative" style={{ width: size * 0.4, height: size * 0.4, color: iconColor, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} strokeWidth={2.5} />
            {/* Banner */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: size * 0.14, width: size * 0.86 }}>
              <div className="px-1 py-0.5 rounded-[3px] text-center" style={{ background: banner, clipPath: 'polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)' }}>
                <span className="text-[7px] font-extrabold tracking-tight text-white uppercase leading-tight block" style={{ fontSize: Math.max(6, size * 0.075) }}>
                  {b.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}