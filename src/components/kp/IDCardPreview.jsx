import React from 'react';
import { Building2, Calendar, Phone, MapPin, User, Droplet } from 'lucide-react';

/**
 * Reusable front/back ID card preview.
 * props: person {name, type, lrn/employee_id, grade, section, photo_url, qr_id, birth_date, blood_type, address, parent_name, parent_contact}
 *       school, cardNumber, template {primary_color, footer_text}
 */
export function IDCardFront({ person, school, cardNumber, template }) {
  const color = template?.primary_color || '#004D5A';
  const footer = template?.footer_text || 'Be Respectful. Be Responsible. Be a KeepPeer.';
  const qrData = person.qr_id || person.lrn || person.employee_id || cardNumber;
  const year = school?.academic_year || '2026-2027';

  return (
    <div className="w-full aspect-[1.585/1] rounded-2xl shadow-xl overflow-hidden bg-white flex flex-col border border-gray-100">
      {/* Header band */}
      <div className="px-4 py-2.5 flex items-center gap-2.5" style={{ background: color }}>
        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 overflow-hidden">
          {school?.logo_url
            ? <img src={school.logo_url} className="w-full h-full object-cover" />
            : <Building2 className="w-4 h-4 text-white" />}
        </div>
        <div className="min-w-0">
          <div className="text-white text-[10px] font-bold uppercase tracking-wide truncate">{school?.school_name || 'KeepPeer Elementary School'}</div>
          <div className="text-white/70 text-[7px]">School ID: {school?.school_id || '—'}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-white/60 text-[6px] uppercase">Academic Year</div>
          <div className="text-white text-[8px] font-semibold">{year}</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-3 flex gap-3">
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 shrink-0" style={{ borderColor: color }}>
            {person?.photo_url
              ? <img src={person.photo_url} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gray-100 flex items-center justify-center"><User className="w-6 h-6 text-gray-400" /></div>}
          </div>
          <span className="px-2 py-0.5 rounded-full text-[6px] font-bold uppercase" style={{ background: `${color}18`, color }}>{person?.type === 'employee' ? 'Staff' : 'Student'}</span>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div>
            <div className="text-[7px] text-gray-400 uppercase tracking-wide">Name</div>
            <div className="text-[13px] font-bold text-gray-800 leading-tight truncate">{person?.name || '—'}</div>
          </div>
          {person?.type === 'student' && (
            <div>
              <div className="text-[7px] text-gray-400 uppercase tracking-wide">Grade & Section</div>
              <div className="text-[10px] text-gray-600 font-medium">{person.grade || '—'} - {person.section || '—'}</div>
            </div>
          )}
          {person?.type === 'employee' && (
            <div>
              <div className="text-[7px] text-gray-400 uppercase tracking-wide">Position</div>
              <div className="text-[10px] text-gray-600 font-medium">{person.position || '—'}</div>
            </div>
          )}
          <div>
            <div className="text-[7px] text-gray-400 uppercase tracking-wide">{person?.type === 'student' ? 'LRN' : 'Employee ID'}</div>
            <div className="text-[10px] text-gray-600 font-mono">{person?.type === 'student' ? (person.lrn || '—') : (person.employee_id || '—')}</div>
          </div>
          <div>
            <div className="text-[7px] text-gray-400 uppercase tracking-wide">ID Number</div>
            <div className="text-[10px] text-gray-600 font-mono">{cardNumber || '—'}</div>
          </div>
        </div>

        <div className="w-16 h-16 shrink-0 bg-white border border-gray-100 rounded-lg p-1 flex items-center justify-center">
          {qrData && <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`} alt="QR" className="w-full h-full" />}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-gray-100 text-center">
        <span className="text-[7px] italic text-gray-400">{footer}</span>
      </div>
    </div>
  );
}

export function IDCardBack({ person, school, template }) {
  const color = template?.primary_color || '#004D5A';
  const isStudent = person?.type === 'student';

  return (
    <div className="w-full aspect-[1.585/1] rounded-2xl shadow-xl overflow-hidden bg-white flex flex-col border border-gray-100">
      <div className="px-4 py-2 flex items-center gap-2" style={{ background: color }}>
        <Building2 className="w-3.5 h-3.5 text-white" />
        <div className="text-white text-[9px] font-bold uppercase tracking-wide">{school?.school_name || 'KeepPeer Elementary School'}</div>
      </div>

      <div className="flex-1 px-4 py-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[8px]">
        <Info icon={User} label={isStudent ? 'LRN' : 'Employee ID'} value={isStudent ? person?.lrn : person?.employee_id} />
        <Info icon={Calendar} label="Date of Birth" value={person?.birth_date || '—'} />
        <Info icon={Droplet} label="Blood Type" value={person?.blood_type || '—'} />
        <Info icon={MapPin} label="Address" value={person?.residential_address || person?.address || '—'} />
        <Info icon={User} label="Guardian" value={isStudent ? (person?.parent_name || '—') : '—'} />
        <Info icon={Phone} label="Contact" value={isStudent ? (person?.parent_contact || '—') : (person?.mobile_number || '—')} />
      </div>

      <div className="px-4 pb-2">
        <div className="rounded-md bg-gray-50 p-1.5 text-[6px] leading-snug text-gray-400 border border-gray-100">
          <span className="font-semibold text-gray-500">Terms & Conditions: </span>
          This ID card is the property of {school?.school_name || 'the school'}. It must be worn at all times within school premises and presented upon request. If found, please return to the address below. Misuse or tampering is a violation of school policy.
        </div>
      </div>

      <div className="px-4 py-1.5 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[7px] text-gray-400 truncate">{school?.address || '—'}</span>
        <span className="text-[7px] text-gray-300 shrink-0">Powered by KeepPeer</span>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-gray-400 uppercase tracking-wide flex items-center gap-1"><Icon className="w-2.5 h-2.5" /> {label}</div>
      <div className="text-gray-700 font-medium truncate">{value}</div>
    </div>
  );
}