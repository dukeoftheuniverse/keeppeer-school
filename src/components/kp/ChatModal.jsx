import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Send, Search, MessageSquare, Loader2, ArrowLeft } from 'lucide-react';

const ACT = ['Quiz', 'Summative Test', 'Activity', 'Project', 'Exam', 'Assignment'];

function convId(a, b) { return [a, b].map(s => (s || '').toLowerCase()).sort().join('||'); }

const roleBadge = (r) => r === 'admin' ? 'bg-red-100 text-red-700' : r === 'teacher' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700';

export default function ChatModal({ open, onClose, me, mode, presetContact, student }) {
  const [contacts, setContacts] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [students, employees, classes, classSubs, msgs] = await Promise.all([
          base44.entities.Student.list().catch(() => []),
          base44.entities.Employee.list().catch(() => []),
          base44.entities.Class.list().catch(() => []),
          base44.entities.ClassSubject.list().catch(() => []),
          base44.entities.Message.list('-created_date', 500).catch(() => []),
        ]);
        const admins = employees.filter(e => e.access_level === 'admin' || /admin|principal/i.test(e.position || ''));
        const adminContacts = admins.map(a => ({ email: a.email, name: `${a.first_name} ${a.last_name}`, role: 'admin', sub: a.position || 'Administrator' }));
        let list = [];
        if (mode === 'admin') {
          const teachers = employees
            .filter(e => e.email && (e.access_level === 'teacher' || /teacher/i.test(e.position || '')))
            .map(e => ({ email: e.email, name: `${e.first_name} ${e.last_name}`, role: 'teacher', sub: e.position || 'Teacher' }));
          const parentMap = new Map();
          students.forEach(s => {
            if (s.enrollment_status === 'archived' || !s.parent_email) return;
            parentMap.set(s.parent_email.toLowerCase(), { email: s.parent_email, name: s.parent_name || s.parent_email, role: 'parent', sub: `Parent of ${s.first_name} ${s.last_name}` });
          });
          list = [...teachers, ...parentMap.values()];
        } else if (mode === 'teacher') {
          const fullName = me.name;
          const ids = new Set();
          classes.forEach(c => { if (c.adviser_id === me.id || c.adviser_name === fullName) ids.add(c.id); });
          classSubs.forEach(cs => { if (cs.teacher_id === me.id || cs.teacher_name === fullName) ids.add(cs.class_id); });
          const myClasses = classes.filter(c => ids.has(c.id));
          const parentMap = new Map();
          students.forEach(s => {
            if (s.enrollment_status === 'archived' || !s.parent_email) return;
            if (myClasses.some(c => c.grade_level === s.grade && c.section === s.section)) {
              parentMap.set(s.parent_email.toLowerCase(), { email: s.parent_email, name: s.parent_name || s.parent_email, role: 'parent', sub: `Parent of ${s.first_name} ${s.last_name}` });
            }
          });
          list = [...parentMap.values(), ...adminContacts];
        } else {
          const myChildren = students.filter(s => s.parent_email && s.parent_email.toLowerCase() === (me.email || '').toLowerCase());
          const childClasses = classes.filter(c => myChildren.some(s => s.grade === c.grade_level && c.section === c.section));
          const childClassIds = new Set(childClasses.map(c => c.id));
          const teacherMap = new Map();
          childClasses.forEach(c => {
            const adv = employees.find(e => e.id === c.adviser_id || c.adviser_name === `${e.first_name} ${e.last_name}`);
            if (adv && adv.email) teacherMap.set(adv.id, { email: adv.email, name: `${adv.first_name} ${adv.last_name}`, role: 'teacher', sub: `Adviser, ${c.grade_level} - ${c.section}` });
          });
          classSubs.forEach(cs => {
            if (!childClassIds.has(cs.class_id)) return;
            const t = employees.find(e => e.id === cs.teacher_id || cs.teacher_name === `${e.first_name} ${e.last_name}`);
            if (t && t.email) teacherMap.set(t.id, { email: t.email, name: `${t.first_name} ${t.last_name}`, role: 'teacher', sub: `Subject: ${cs.subject_name}` });
          });
          list = [...teacherMap.values(), ...adminContacts];
        }
        if (!alive) return;
        const filtered = list.filter(c => c.email && c.email.toLowerCase() !== (me.email || '').toLowerCase());
        let activeContact = null;
        if (presetContact) {
          const found = filtered.find(c => c.email.toLowerCase() === presetContact.email.toLowerCase());
          if (!found) filtered.unshift(presetContact);
          activeContact = found || presetContact;
        }
        setContacts(filtered);
        if (activeContact) setActive(activeContact);
        const mine = (msgs || []).filter(m => (m.sender_email || '').toLowerCase() === (me.email || '').toLowerCase() || (m.recipient_email || '').toLowerCase() === (me.email || '').toLowerCase());
        setAllMessages(mine.sort((a, b) => (a.created_date || '').localeCompare(b.created_date || '')));
      } catch (e) { /* */ }
      finally { if (alive) setLoading(false); }
    })();

    const unsub = base44.entities.Message.subscribe((event) => {
      const m = event.data;
      if (!m) return;
      if ((m.sender_email || '').toLowerCase() === (me.email || '').toLowerCase() || (m.recipient_email || '').toLowerCase() === (me.email || '').toLowerCase()) {
        setAllMessages(prev => {
          if (event.type === 'delete') return prev.filter(x => x.id !== m.id);
          if (event.type === 'update') return prev.map(x => x.id === m.id ? { ...x, ...m } : x);
          if (prev.find(x => x.id === m.id)) return prev;
          return [...prev, m].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
        });
      }
    });
    return () => { alive = false; unsub && unsub(); };
  }, [open, mode, me.email, me.id, me.name, presetContact?.email]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [allMessages, active]);

  const thread = active ? allMessages.filter(m => {
    if (m.conversation_id !== convId(me.email, active.email)) return false;
    if (student) return m.student_id === student.id;
    return true;
  }) : [];
  const unreadFor = (c) => allMessages.filter(m => m.conversation_id === convId(me.email, c.email) && (m.recipient_email || '').toLowerCase() === (me.email || '').toLowerCase() && !m.read).length;

  const send = async () => {
    if (!text.trim() || !active) return;
    setSending(true);
    const cid = convId(me.email, active.email);
    try {
      await base44.entities.Message.create({
        conversation_id: cid,
        sender_email: me.email, sender_name: me.name, sender_role: me.role,
        recipient_email: active.email, recipient_name: active.name, recipient_role: active.role,
        body: text.trim(), read: false,
        student_id: student?.id || '',
        student_name: student ? `${student.first_name} ${student.last_name}` : '',
      });
      setText('');
    } catch (e) { /* */ }
    finally { setSending(false); }
  };

  if (!open) return null;
  const filtered = contacts.filter(c => `${c.name} ${c.role} ${c.sub || ''}`.toLowerCase().includes(q.toLowerCase()));
  const fmtTime = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl h-[78vh] flex overflow-hidden">
        {/* Contacts */}
        <div className={`${active ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-64 border-r border-gray-100 bg-[#F0FAFB]`}>
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[hsl(var(--kp-teal))] font-bold text-sm"><MessageSquare className="w-4 h-4" /> Messages</div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto kp-scroll-thin px-2 pb-2 space-y-1">
            {loading ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 text-[hsl(var(--kp-teal))] animate-spin" /></div> :
              filtered.length === 0 ? <p className="text-xs text-gray-400 text-center py-6">No contacts found.</p> :
              filtered.map(c => {
                const un = unreadFor(c);
                return (
                  <button key={c.email} onClick={() => setActive(c)} className={`w-full text-left p-2.5 rounded-lg transition-all ${active?.email === c.email ? 'bg-[hsl(var(--kp-teal))] text-white' : 'hover:bg-white'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold truncate ${active?.email === c.email ? '' : 'text-[hsl(var(--kp-teal))]'}`}>{c.name}</span>
                      {un > 0 && <span className="ml-1.5 shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{un}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${active?.email === c.email ? 'bg-white/20 text-white' : roleBadge(c.role)}`}>{c.role}</span>
                      <span className={`text-[11px] truncate ${active?.email === c.email ? 'text-white/80' : 'text-gray-400'}`}>{c.sub}</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Conversation */}
        <div className={`${active ? 'flex' : 'hidden sm:flex'} flex-col flex-1`}>
          {active ? (
            <>
              <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                <button onClick={() => setActive(null)} className="sm:hidden text-[hsl(var(--kp-teal))]"><ArrowLeft className="w-4 h-4" /></button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[hsl(var(--kp-teal))] truncate">{active.name}</div>
                  <div className="flex items-center gap-1.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadge(active.role)}`}>{active.role}</span><span className="text-[11px] text-gray-400 truncate">{active.sub}</span></div>
                  {student && <div className="text-[10px] mt-0.5 inline-flex items-center gap-1 text-[#0F766E] bg-[#E0F7FA] px-1.5 py-0.5 rounded">Re: {student.first_name} {student.last_name}</div>}
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hidden sm:block"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto kp-scroll-thin p-4 space-y-2.5 bg-[#F7FCFD]">
                {thread.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">No messages yet. Say hello!</p> :
                  thread.map(m => {
                    const mine = (m.sender_email || '').toLowerCase() === (me.email || '').toLowerCase();
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${mine ? 'bg-[hsl(var(--kp-teal))] text-white rounded-br-md' : 'bg-white border border-gray-100 text-[#1f2937] rounded-bl-md'}`}>
                          <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                          <div className={`text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'text-gray-400'}`}>{fmtTime(m.created_date)}</div>
                        </div>
                      </div>
                    );
                  })}
                <div ref={endRef} />
              </div>
              <div className="p-3 border-t border-gray-100 flex items-center gap-2">
                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Type a message..." className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                <button onClick={send} disabled={sending || !text.trim()} className="w-10 h-10 rounded-full bg-[hsl(var(--kp-teal))] text-white flex items-center justify-center disabled:opacity-50 hover:brightness-105"><Send className="w-4 h-4" /></button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageSquare className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm">Select a contact to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}