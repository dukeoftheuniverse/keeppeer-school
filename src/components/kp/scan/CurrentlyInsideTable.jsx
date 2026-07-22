import React from 'react';
import { Avatar } from '@/components/kp/ui';
import { MapPin } from 'lucide-react';

function durationLabel(createdDate, now) {
  const ms = now - new Date(createdDate).getTime();
  if (isNaN(ms) || ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

/** Bottom-left: table of everyone currently inside the campus. */
export default function CurrentlyInsideTable({ insidePeople = [], lastLocByPerson = {}, now, className }) {
  const rows = insidePeople.map((p) => {
    const last = lastLocByPerson[p.id];
    return {
      p,
      timeIn: last?.time || '—',
      camera: last?.scanner_location || '—',
      duration: last?.created_date ? durationLabel(last.created_date, now) : '—',
    };
  });

  return (
    <div className={`kp-panel rounded-2xl p-3 sm:p-4 ${className || ''}`}>
      <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3">
        Currently Inside Campus{' '}
        <span className="text-xs font-normal text-gray-400">({rows.length})</span>
      </h3>
      <div className="overflow-x-auto kp-scroll-thin">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-200">
              <th className="py-2 pr-2 font-medium">Photo</th>
              <th className="py-2 pr-2 font-medium">Name</th>
              <th className="py-2 pr-2 font-medium">Role</th>
              <th className="py-2 pr-2 font-medium">Time In</th>
              <th className="py-2 pr-2 font-medium">Entry Camera</th>
              <th className="py-2 pr-2 font-medium">Duration</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-400">No one inside.</td>
              </tr>
            )}
            {rows.map(({ p, timeIn, camera, duration }) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                <td className="py-2 pr-2"><Avatar name={p.name} src={p.photo_url} size="w-7 h-7" /></td>
                <td className="py-2 pr-2 font-medium text-gray-700 truncate max-w-[10rem]">{p.name}</td>
                <td className="py-2 pr-2 text-gray-500 capitalize">{p.type === 'student' ? 'Student' : 'Employee'}</td>
                <td className="py-2 pr-2 text-gray-500">{timeIn}</td>
                <td className="py-2 pr-2 text-gray-500 truncate max-w-[8rem]">
                  <MapPin className="w-3 h-3 inline mr-1 text-gray-400" />
                  {camera}
                </td>
                <td className="py-2 pr-2 text-gray-500">{duration}</td>
                <td className="py-2"><span className="text-green-600 font-semibold">Inside</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}