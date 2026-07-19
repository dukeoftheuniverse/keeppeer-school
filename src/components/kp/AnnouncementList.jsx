import React from 'react';
import { Megaphone, AlertTriangle, CloudRain, Calendar, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const CAT_ICON = {
  school_announcement: Megaphone,
  class_announcement: Megaphone,
  weather_alert: CloudRain,
  event: Calendar,
};

const PRIO = {
  urgent: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
  high: { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
  normal: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
};

export default function AnnouncementList({ announcements = [], emptyMessage = 'No announcements', onAdd, addLabel = 'Add Announcement', maxHeight = '260px' }) {
  return (
    <div>
      <div className="space-y-2.5 overflow-y-auto kp-scroll-thin" style={{ maxHeight }}>
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{emptyMessage}</p>
        ) : announcements.map(a => {
          const Icon = CAT_ICON[a.category] || Megaphone;
          const p = PRIO[a.priority] || PRIO.normal;
          return (
            <div key={a.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-[hsl(var(--kp-teal))] shrink-0" />
                <span className={cn("w-1.5 h-1.5 rounded-full", p.dot)} />
                <span className="text-sm font-medium text-[hsl(var(--kp-teal))] flex-1 truncate">{a.title}</span>
                {a.audience === 'class' && a.target_class && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))] font-medium shrink-0">{a.target_class}</span>
                )}
                {a.audience === 'teacher' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium shrink-0">Teacher</span>
                )}
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{a.content}</p>
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-400">
                <span>{a.author_name || 'Administrator'}</span>
                <span>{a.date}</span>
              </div>
            </div>
          );
        })}
      </div>
      {onAdd && (
        <button onClick={onAdd} className="mt-3 w-full py-2 rounded-lg border border-dashed border-[hsl(var(--kp-teal))]/30 text-[hsl(var(--kp-teal))] text-sm font-medium hover:bg-[hsl(var(--accent))] flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> {addLabel}
        </button>
      )}
    </div>
  );
}