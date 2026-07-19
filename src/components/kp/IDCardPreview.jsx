import React from 'react';
import { GraduationCap, User } from 'lucide-react';

const QR_BASE = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=';

function resolve(template) {
  return {
    color: template?.primary_color || '#004D5A',
    accent: template?.accent_color || template?.primary_color || '#2BB5C6',
    fontColor: template?.font_color || '#1f2937',
    footer: template?.footer_text || 'Be Respectful. Be Responsible. Be a KeepPeer.',
    logo: template?.logo_url,
    orientation: template?.orientation || 'landscape',
    bg: template?.background_url,
    photoShape: template?.photo_shape || 'circle',
    showQr: template?.show_qr !== false,
    showPhoto: template?.show_photo !== false,
    showGrade: template?.show_grade !== false,
    showId: template?.show_id_number !== false,
  };
}

function Photo({ person, cfg, color, size }) {
  const radius = cfg.photoShape === 'square' ? 'rounded-lg' : 'rounded-full';
  if (!cfg.showPhoto) return null;
  return (
    <div className={`${size} ${radius} overflow-hidden border-2 shrink-0`} style={{ borderColor: color }}>
      {person?.photo_url ? <img src={person.photo_url} className="w-full h-full object-cover" /> : <div className={`w-full h-full bg-gray-100 flex items-center justify-center ${radius}`}><User className="w-1/2 h-1/2 text-gray-400" /></div>}
    </div>
  );
}

function QrBlock({ qrData, size = 'w-16 h-16' }) {
  return (
    <div className={`${size} shrink-0 bg-white border border-gray-100 rounded-lg p-1 flex items-center justify-center`}>
      <img src={QR_BASE + encodeURIComponent(qrData)} alt="QR" className="w-full h-full" />
    </div>
  );
}

export function IDCardFront({ person, school, cardNumber, template }) {
  const cfg = resolve(template);
  const color = cfg.color;
  const accent = cfg.accent;
  const logo = cfg.logo || school?.logo_url;
  const bg = cfg.bg;
  const qrData = person.qr_id || person.lrn || person.employee_id || cardNumber || 'KEEPPEER';
  const schoolName = template?.school_name_override || school?.school_name || 'KeepPeer Elementary School';
  const year = school?.academic_year || '2026-2027';
  const typeBadge = person?.type === 'employee' ? 'Staff' : 'Student';

  if (cfg.orientation === 'portrait') {
    return (
      <div className="w-full aspect-[1/1.585] rounded-2xl shadow-xl overflow-hidden bg-white flex flex-col border border-gray-100" style={{ color: cfg.fontColor }}>
        <div className="px-3 py-2.5 flex items-center gap-2 relative" style={{ background: color }}>
          {bg && <img src={bg} className="absolute inset-0 w-full h-full object-cover opacity-20" />}
          <div className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0 overflow-hidden">
            {logo ? <img src={logo} className="w-full h-full object-cover" /> : <GraduationCap className="w-5 h-5 text-white" />}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="text-white text-[9px] font-bold uppercase tracking-wide truncate leading-tight">{schoolName}</div>
            <div className="text-white/70 text-[7px]">School ID: {school?.school_id || '—'}</div>
          </div>
          <div className="relative text-right">
            <div className="text-white/60 text-[6px] uppercase">SY</div>
            <div className="text-white text-[8px] font-semibold">{year}</div>
          </div>
        </div>

        <div className="flex flex-col items-center px-4 py-3 flex-1">
          <Photo person={person} cfg={cfg} color={color} size="w-20 h-20" />
          <span className="px-2.5 py-0.5 rounded-full text-[7px] font-bold uppercase mb-2 mt-1.5" style={{ background: `${color}18`, color }}>{typeBadge}</span>
          <div className="text-center w-full">
            <div className="text-[7px] text-gray-400 uppercase tracking-wide">Name</div>
            <div className="text-sm font-bold leading-tight">{person?.name || '—'}</div>
          </div>
          {cfg.showGrade && (
            <div className="mt-1.5 text-center w-full">
              <div className="text-[7px] text-gray-400 uppercase tracking-wide">{person?.type === 'student' ? 'Grade & Section' : 'Position'}</div>
              <div className="text-[10px] font-medium" style={{ color: accent }}>{person?.type === 'student' ? `${person.grade || '—'} - ${person.section || '—'}` : (person.position || '—')}</div>
            </div>
          )}
          <div className="mt-1.5 text-center w-full">
            <div className="text-[7px] text-gray-400 uppercase tracking-wide">{person?.type === 'student' ? 'LRN' : 'Employee ID'}</div>
            <div className="text-[10px] font-mono">{person?.type === 'student' ? (person.lrn || '—') : (person.employee_id || '—')}</div>
          </div>
          {cfg.showQr && (
            <div className="mt-auto pt-2">
              <QrBlock qrData={qrData} size="w-20 h-20" />
              {cfg.showId && <div className="text-center text-[8px] text-gray-500 font-mono mt-1">{cardNumber || '—'}</div>}
            </div>
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-gray-100 text-center" style={{ background: `${color}08` }}>
          <span className="text-[7px] italic text-gray-400">{cfg.footer}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full aspect-[1.585/1] rounded-2xl shadow-xl overflow-hidden bg-white flex flex-col border border-gray-100" style={{ color: cfg.fontColor }}>
      <div className="px-4 py-2.5 flex items-center gap-2.5 relative" style={{ background: color }}>
        {bg && <img src={bg} className="absolute inset-0 w-full h-full object-cover opacity-20" />}
        <div className="relative w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 overflow-hidden">
          {logo ? <img src={logo} className="w-full h-full object-cover" /> : <GraduationCap className="w-4 h-4 text-white" />}
        </div>
        <div className="relative min-w-0">
          <div className="text-white text-[10px] font-bold uppercase tracking-wide truncate">{schoolName}</div>
          <div className="text-white/70 text-[7px]">School ID: {school?.school_id || '—'}</div>
        </div>
        <div className="relative ml-auto text-right">
          <div className="text-white/60 text-[6px] uppercase">Academic Year</div>
          <div className="text-white text-[8px] font-semibold">{year}</div>
        </div>
      </div>

      <div className="flex-1 px-4 py-3 flex gap-3">
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <Photo person={person} cfg={cfg} color={color} size="w-16 h-16" />
          <span className="px-2 py-0.5 rounded-full text-[6px] font-bold uppercase" style={{ background: `${color}18`, color }}>{typeBadge}</span>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div>
            <div className="text-[7px] text-gray-400 uppercase tracking-wide">Name</div>
            <div className="text-[13px] font-bold leading-tight truncate">{person?.name || '—'}</div>
          </div>
          {cfg.showGrade && person?.type === 'student' && (
            <div>
              <div className="text-[7px] text-gray-400 uppercase tracking-wide">Grade & Section</div>
              <div className="text-[10px] font-medium" style={{ color: accent }}>{person.grade || '—'} - {person.section || '—'}</div>
            </div>
          )}
          {cfg.showGrade && person?.type === 'employee' && (
            <div>
              <div className="text-[7px] text-gray-400 uppercase tracking-wide">Position</div>
              <div className="text-[10px] font-medium" style={{ color: accent }}>{person.position || '—'}</div>
            </div>
          )}
          <div>
            <div className="text-[7px] text-gray-400 uppercase tracking-wide">{person?.type === 'student' ? 'LRN' : 'Employee ID'}</div>
            <div className="text-[10px] font-mono">{person?.type === 'student' ? (person.lrn || '—') : (person.employee_id || '—')}</div>
          </div>
          {cfg.showId && (
            <div>
              <div className="text-[7px] text-gray-400 uppercase tracking-wide">ID Number</div>
              <div className="text-[10px] font-mono">{cardNumber || '—'}</div>
            </div>
          )}
        </div>

        {cfg.showQr && <QrBlock qrData={qrData} size="w-16 h-16" />}
      </div>

      <div className="px-4 py-1.5 border-t border-gray-100 text-center">
        <span className="text-[7px] italic text-gray-400">{cfg.footer}</span>
      </div>
    </div>
  );
}

export function IDCardBack({ person, school, template }) {
  const cfg = resolve(template);
  const color = cfg.color;
  const logo = cfg.logo || school?.logo_url;
  const orientation = cfg.orientation || 'landscape';
  const isStudent = person?.type === 'student';
  const schoolName = template?.school_name_override || school?.school_name || 'KeepPeer Elementary School';

  if (orientation === 'portrait') {
    return (
      <div className="w-full aspect-[1/1.585] rounded-2xl shadow-xl overflow-hidden bg-white flex flex-col border border-gray-100">
        <div className="px-3 py-2 flex items-center justify-center gap-2" style={{ background: color }}>
          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center overflow-hidden">
            {logo ? <img src={logo} className="w-full h-full object-cover" /> : <GraduationCap className="w-3.5 h-3.5 text-white" />}
          </div>
          <div className="text-white text-[9px] font-bold uppercase tracking-wide">{schoolName}</div>
        </div>
        <div className="flex-1 px-4 py-3 space-y-2 text-[9px]">
          <Info label={isStudent ? 'LRN' : 'Employee ID'} value={isStudent ? person?.lrn : person?.employee_id} />
          <Info label="Date of Birth" value={person?.birth_date || '—'} />
          <Info label="Blood Type" value={person?.blood_type || '—'} />
          <Info label="Address" value={person?.residential_address || '—'} />
          <Info label="Guardian" value={isStudent ? (person?.parent_name || '—') : '—'} />
          <Info label="Contact" value={isStudent ? (person?.parent_contact || '—') : (person?.mobile_number || '—')} />
          <div className="rounded-md bg-gray-50 p-2 text-[7px] leading-snug text-gray-400 border border-gray-100 mt-2">
            <span className="font-semibold text-gray-500">Terms & Conditions: </span>
            This ID card is the property of {schoolName}. If found, please return to the address below.
          </div>
        </div>
        <div className="px-3 py-1.5 border-t border-gray-100 text-center">
          <span className="text-[7px] text-gray-400">{school?.address || '—'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full aspect-[1.585/1] rounded-2xl shadow-xl overflow-hidden bg-white flex flex-col border border-gray-100">
      <div className="px-4 py-2 flex items-center gap-2" style={{ background: color }}>
        <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center overflow-hidden">
          {logo ? <img src={logo} className="w-full h-full object-cover" /> : <GraduationCap className="w-3.5 h-3.5 text-white" />}
        </div>
        <div className="text-white text-[9px] font-bold uppercase tracking-wide">{schoolName}</div>
      </div>
      <div className="flex-1 px-4 py-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[8px]">
        <Info label={isStudent ? 'LRN' : 'Employee ID'} value={isStudent ? person?.lrn : person?.employee_id} />
        <Info label="Date of Birth" value={person?.birth_date || '—'} />
        <Info label="Blood Type" value={person?.blood_type || '—'} />
        <Info label="Address" value={person?.residential_address || person?.address || '—'} />
        <Info label="Guardian" value={isStudent ? (person?.parent_name || '—') : '—'} />
        <Info label="Contact" value={isStudent ? (person?.parent_contact || '—') : (person?.mobile_number || '—')} />
      </div>
      <div className="px-4 pb-2">
        <div className="rounded-md bg-gray-50 p-1.5 text-[6px] leading-snug text-gray-400 border border-gray-100">
          <span className="font-semibold text-gray-500">Terms & Conditions: </span>
          This ID card is the property of {schoolName}. It must be worn at all times within school premises. If found, please return to the address below.
        </div>
      </div>
      <div className="px-4 py-1.5 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[7px] text-gray-400 truncate">{school?.address || '—'}</span>
        <span className="text-[7px] text-gray-300 shrink-0">Powered by KeepPeer</span>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-gray-700 font-medium truncate">{value}</div>
    </div>
  );
}