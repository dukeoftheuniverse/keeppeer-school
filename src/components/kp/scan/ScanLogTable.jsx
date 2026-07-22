import React, { useState, useMemo } from 'react';
import { Avatar } from '@/components/kp/ui';
import { ChevronLeft, ChevronRight, LogIn, LogOut } from 'lucide-react';

const PAGE = 8;

/** Bottom-right bottom: paginated "All Cameras" scan log. */
export default function ScanLogTable({ logbook = [], peopleMap = {}, className }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(logbook.length / PAGE));
  const cur = Math.min(page, totalPages);
  const rows = useMemo(() => logbook.slice((cur - 1) * PAGE, cur * PAGE), [logbook, cur]);

  return (
    <div className={`kp-panel rounded-2xl p-3 sm:p-4 ${className || ''}`}>
      <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3">All Cameras — Scan Log</h3>
      <div className="overflow-x-auto kp-scroll-thin">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-200">
              <th className="py-2 pr-2 font-medium">Photo</th>
              <th className="py-2 pr-2 font-medium">Action</th>
              <th className="py-2 pr-2 font-medium">Status</th>
              <th className="py-2 pr-2 font-medium">Camera</th>
              <th className="py-2 pr-2 font-medium">Confidence</th>
              <th className="py-2 font-medium">Method</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">No records.</td>
              </tr>
            )}
            {rows.map((s) => {
              const p = peopleMap[s.person_id];
              return (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                  <td className="py-2 pr-2"><Avatar name={s.person_name} src={p?.photo_url} size="w-7 h-7" /></td>
                  <td className="py-2 pr-2">
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        s.scan_type === 'time_in' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {s.scan_type === 'time_in' ? <LogIn className="w-2.5 h-2.5" /> : <LogOut className="w-2.5 h-2.5" />}
                      {s.scan_type === 'time_in' ? 'Time In' : 'Time Out'}
                    </span>
                  </td>
                  <td className="py-2 pr-2 capitalize text-gray-600">{s.status}</td>
                  <td className="py-2 pr-2 text-gray-500 truncate max-w-[8rem]">{s.scanner_location || '—'}</td>
                  <td className="py-2 pr-2 text-gray-500">{s.confidence_score ? `${s.confidence_score}%` : '—'}</td>
                  <td className="py-2 capitalize text-gray-500">{s.method}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button
            onClick={() => setPage(Math.max(1, cur - 1))}
            disabled={cur <= 1}
            className="px-2 py-1 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" /> Prev
          </button>
          <span className="px-2.5 py-1 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-xs font-semibold">
            {cur} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, cur + 1))}
            disabled={cur >= totalPages}
            className="px-2 py-1 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 flex items-center gap-1"
          >
            Next <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}