import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Plus } from 'lucide-react';

export default function DbCombobox({ label, value, onChange, options = [], placeholder = 'Search or type...', className, error }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (!open) setQuery(value || ''); }, [value, open]);

  const q = query.toLowerCase();
  const filtered = (options || []).filter(o => String(o).toLowerCase().includes(q)).slice(0, 50);
  const exactMatch = (options || []).some(o => String(o).toLowerCase() === q.trim() && q.trim());
  const showCreate = query.trim() && !exactMatch;

  return (
    <div className={className} ref={ref}>
      {label && <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">{label}</label>}
      <div className="relative">
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(e.target.value); }}
          placeholder={placeholder}
          className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15 ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-[hsl(var(--kp-teal))]'}`}
        />
        <button type="button" tabIndex={-1} onClick={() => setOpen(!open)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
          <ChevronDown className="w-4 h-4" />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto kp-scroll-thin">
            {filtered.length === 0 && !showCreate ? (
              <div className="px-3 py-2 text-xs text-gray-400">No matches — type to add new</div>
            ) : (
              <>
                {filtered.map(o => (
                  <button key={o} type="button" onMouseDown={(e) => { e.preventDefault(); onChange(o); setQuery(o); setOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[hsl(var(--accent))] flex items-center justify-between">
                    <span className="truncate">{o}</span>
                    {value === o && <Check className="w-3.5 h-3.5 text-[hsl(var(--kp-teal))] shrink-0" />}
                  </button>
                ))}
                {showCreate && (
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(query.trim()); setOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 flex items-center gap-1.5 text-[hsl(var(--kp-green))] border-t border-gray-100">
                    <Plus className="w-3.5 h-3.5 shrink-0" /> Use "{query.trim()}"
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}