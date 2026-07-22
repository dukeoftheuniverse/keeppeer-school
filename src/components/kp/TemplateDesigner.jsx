import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { KpButton } from '@/components/kp/ui';
import { X, Upload, Loader2, RectangleHorizontal, RectangleVertical, Image as ImageIcon, Type, QrCode, User, Save, Eye, EyeOff, Trash2, Layers } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const QR_BASE = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=';
const SAMPLE_LOGO = 'https://media.base44.com/images/public/6a599666b848d4d07cd0e975/af88c433d_generated_image.png';
const FONTS = ['Inter', 'Arial', 'Georgia', 'Courier New', 'Times New Roman', 'Verdana', 'Trebuchet MS'];

const DEFAULT_ELEMENTS = {
  landscape: {
    logo: { x: 3, y: 4, w: 9, h: 16, visible: true, shape: 'circle' },
    schoolName: { x: 14, y: 5, w: 60, h: 6, visible: true, fontSize: 13, color: '#ffffff', align: 'left', bold: true, font: 'Inter' },
    photo: { x: 6, y: 34, w: 16, h: 28, visible: true, shape: 'circle' },
    name: { x: 25, y: 36, w: 45, h: 8, visible: true, fontSize: 15, color: '#1f2937', align: 'left', bold: true, font: 'Inter' },
    grade: { x: 25, y: 46, w: 45, h: 6, visible: true, fontSize: 11, color: '#2BB5C6', align: 'left', bold: false, font: 'Inter' },
    idNumber: { x: 25, y: 53, w: 45, h: 6, visible: true, fontSize: 11, color: '#1f2937', align: 'left', bold: false, font: 'Inter' },
    qr: { x: 75, y: 32, w: 20, h: 35, visible: true },
    footer: { x: 5, y: 90, w: 90, h: 6, visible: true, fontSize: 8, color: '#9ca3af', align: 'center', bold: false, italic: true, font: 'Inter' },
  },
  portrait: {
    logo: { x: 40, y: 4, w: 14, h: 9, visible: true, shape: 'circle' },
    schoolName: { x: 10, y: 14, w: 80, h: 5, visible: true, fontSize: 10, color: '#ffffff', align: 'center', bold: true, font: 'Inter' },
    photo: { x: 32, y: 24, w: 36, h: 24, visible: true, shape: 'circle' },
    name: { x: 10, y: 51, w: 80, h: 6, visible: true, fontSize: 14, color: '#1f2937', align: 'center', bold: true, font: 'Inter' },
    grade: { x: 10, y: 58, w: 80, h: 5, visible: true, fontSize: 10, color: '#2BB5C6', align: 'center', bold: false, font: 'Inter' },
    idNumber: { x: 10, y: 64, w: 80, h: 5, visible: true, fontSize: 10, color: '#1f2937', align: 'center', bold: false, font: 'Inter' },
    qr: { x: 35, y: 74, w: 30, h: 18, visible: true },
    footer: { x: 10, y: 93, w: 80, h: 5, visible: true, fontSize: 7, color: '#9ca3af', align: 'center', bold: false, italic: true, font: 'Inter' },
  },
};

const ELEMENT_META = {
  logo: { label: 'Logo', icon: ImageIcon, type: 'image' },
  schoolName: { label: 'School Name', icon: Type, type: 'text' },
  photo: { label: 'Photo', icon: User, type: 'image' },
  name: { label: 'Name', icon: Type, type: 'text' },
  grade: { label: 'Grade / Position', icon: Type, type: 'text' },
  idNumber: { label: 'ID Number', icon: Type, type: 'text' },
  qr: { label: 'QR Code', icon: QrCode, type: 'image' },
  footer: { label: 'Footer Text', icon: Type, type: 'text' },
};

function parseLayout(template) {
  if (template?.layout) {
    try { return JSON.parse(template.layout); } catch (e) { /* fallthrough */ }
  }
  return JSON.parse(JSON.stringify(DEFAULT_ELEMENTS[template?.orientation || 'landscape']));
}

export default function TemplateDesigner({ template, school, tab, onSave, onClose }) {
  const [orientation, setOrientation] = useState(template?.orientation || 'landscape');
  const [primaryColor, setPrimaryColor] = useState(template?.primary_color || '#004D5A');
  const [accentColor, setAccentColor] = useState(template?.accent_color || template?.primary_color || '#2BB5C6');
  const [fontColor, setFontColor] = useState(template?.font_color || '#1f2937');
  const [headerFont, setHeaderFont] = useState(template?.header_font || 'Inter');
  const [bodyFont, setBodyFont] = useState(template?.body_font || 'Inter');
  const [logoUrl, setLogoUrl] = useState(template?.logo_url || school?.logo_url || SAMPLE_LOGO);
  const [backgroundUrl, setBackgroundUrl] = useState(template?.background_url || '');
  const [samplePhotoUrl, setSamplePhotoUrl] = useState('');
  const [name, setName] = useState(template?.name || 'Untitled Template');
  const [elements, setElements] = useState(() => parseLayout(template));
  const [selected, setSelected] = useState('name');
  const [uploading, setUploading] = useState(false);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const isLandscape = orientation === 'landscape';
  const cardW = isLandscape ? 560 : 360;
  const cardH = isLandscape ? Math.round(560 / 1.585) : Math.round(360 * 1.585);

  const sample = {
    name: 'Juan Dela Cruz', type: tab, grade: 'Grade 7', section: 'A',
    lrn: '13600125001', employee_id: 'EMP-001', photo_url: '', qr_id: 'KP-SAMPLE-001',
    position: 'Teacher I',
  };
  const schoolName = template?.school_name_override || school?.school_name || 'KeepPeer Elementary School';
  const cardNumber = 'ID-00000001';
  const qrData = sample.qr_id;

  const updateEl = (key, patch) => setElements(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setLogoUrl(file_url);
    } catch (err) {
      toast({ title: 'Logo upload failed', description: String(err?.message || err), variant: 'destructive' });
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleBgUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setBackgroundUrl(file_url);
    } catch (err) {
      toast({ title: 'Background upload failed', description: String(err?.message || err), variant: 'destructive' });
    }
    setUploading(false);
    e.target.value = '';
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSamplePhotoUrl(file_url);
    } catch (err) {
      toast({ title: 'Photo upload failed', description: String(err?.message || err), variant: 'destructive' });
    }
    setUploading(false);
    e.target.value = '';
  };

  const onPointerDown = (e, key) => {
    e.stopPropagation();
    setSelected(key);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      origX: elements[key].x,
      origY: elements[key].y,
      rectW: rect.width,
      rectH: rect.height,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / d.rectW) * 100;
    const dy = ((e.clientY - d.startY) / d.rectH) * 100;
    let nx = Math.max(0, Math.min(100 - elements[d.key].w, d.origX + dx));
    let ny = Math.max(0, Math.min(100 - elements[d.key].h, d.origY + dy));
    updateEl(d.key, { x: nx, y: ny });
  };

  const onPointerUp = (e) => {
    if (dragRef.current) e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  const handleSave = async () => {
    try {
      await onSave({
        name,
        orientation,
        primary_color: primaryColor,
        accent_color: accentColor,
        font_color: fontColor,
        header_font: headerFont,
        body_font: bodyFont,
        logo_url: logoUrl,
        background_url: backgroundUrl,
        layout: JSON.stringify(elements),
      });
      toast({ title: 'Design saved' });
    } catch (e) {
      toast({ title: 'Failed to save design', description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const sel = elements[selected];
  const selMeta = ELEMENT_META[selected];

  const renderElement = (key) => {
    const el = elements[key];
    if (!el.visible) return null;
    const meta = ELEMENT_META[key];
    const base = {
      position: 'absolute',
      left: `${el.x}%`,
      top: `${el.y}%`,
      width: `${el.w}%`,
      height: `${el.h}%`,
      cursor: 'move',
      outline: selected === key ? '2px solid #2BB5C6' : 'none',
      boxSizing: 'border-box',
    };
    const handlers = { onPointerDown: (e) => onPointerDown(e, key), onPointerMove, onPointerUp };

    if (meta.type === 'image') {
      const radius = el.shape === 'square' ? '8px' : '50%';
      let src;
      if (key === 'logo') src = logoUrl;
      else if (key === 'qr') src = QR_BASE + encodeURIComponent(qrData);
      else src = samplePhotoUrl || sample.photo_url;
      return (
        <div key={key} style={base} {...handlers} className="overflow-hidden">
          {src ? (
            <img src={src} alt={key} className="w-full h-full object-cover pointer-events-none" style={{ borderRadius: radius, border: '2px solid #fff' }} draggable={false} />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center" style={{ borderRadius: radius, border: '2px solid #fff' }}>
              <meta.icon className="w-1/3 h-1/3 text-gray-400" />
            </div>
          )}
        </div>
      );
    }

    // text element
    let text;
    if (key === 'schoolName') text = schoolName;
    else if (key === 'name') text = sample.name;
    else if (key === 'grade') text = tab === 'student' ? `${sample.grade} - ${sample.section}` : sample.position;
    else if (key === 'idNumber') text = cardNumber;
    else if (key === 'footer') text = template?.footer_text || 'Be Respectful. Be Responsible. Be a KeepPeer.';
    const isHeader = key === 'schoolName';
    return (
      <div key={key} style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start' }} {...handlers}>
        <span style={{
          fontSize: `${el.fontSize * (cardW / 560)}px`,
          color: el.color,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? 'italic' : 'normal',
          fontFamily: el.font || (isHeader ? headerFont : bodyFont),
          textTransform: isHeader ? 'uppercase' : 'none',
          letterSpacing: isHeader ? '0.05em' : '0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          pointerEvents: 'none',
          lineHeight: 1.1,
        }}>{text}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-gray-200 bg-[hsl(var(--kp-teal))] text-white shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-none">
          <Layers className="w-5 h-5 shrink-0" />
          <input value={name} onChange={e => setName(e.target.value)} className="bg-white/15 px-3 py-1 rounded-lg text-sm font-medium text-white placeholder-white/60 focus:outline-none focus:bg-white/25 w-40 sm:w-56 min-w-0" placeholder="Template name" />
          <span className="text-xs text-white/70 capitalize hidden md:inline">— {tab} {orientation}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1 bg-white/15 rounded-lg p-0.5">
            <button onClick={() => { setOrientation('landscape'); if (!template?.layout) setElements(JSON.parse(JSON.stringify(DEFAULT_ELEMENTS.landscape))); }} className={`p-1.5 rounded-md ${orientation === 'landscape' ? 'bg-white text-[hsl(var(--kp-teal))]' : 'text-white'}`}><RectangleHorizontal className="w-4 h-4" /></button>
            <button onClick={() => { setOrientation('portrait'); if (!template?.layout) setElements(JSON.parse(JSON.stringify(DEFAULT_ELEMENTS.portrait))); }} className={`p-1.5 rounded-md ${orientation === 'portrait' ? 'bg-white text-[hsl(var(--kp-teal))]' : 'text-white'}`}><RectangleVertical className="w-4 h-4" /></button>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15"><X className="w-5 h-5" /></button>
          <KpButton variant="green" onClick={handleSave} className="shrink-0"><Save className="w-4 h-4" /> Save Design</KpButton>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left: layers */}
        <div className="order-2 md:order-1 w-full md:w-56 shrink-0 md:border-r border-b md:border-b-0 border-gray-200 bg-gray-50/60 p-3 overflow-y-auto kp-scroll-thin max-h-[45vh] md:max-h-none">
          <h4 className="text-[10px] font-bold uppercase text-gray-400 mb-2">Elements</h4>
          <div className="space-y-1">
            {Object.keys(ELEMENT_META).map(key => {
              const meta = ELEMENT_META[key];
              const el = elements[key];
              return (
                <div key={key} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer ${selected === key ? 'bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))]' : 'text-gray-600 hover:bg-gray-100'}`} onClick={() => setSelected(key)}>
                  <meta.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-medium flex-1 truncate">{meta.label}</span>
                  <button onClick={(e) => { e.stopPropagation(); updateEl(key, { visible: !el.visible }); }} className="text-gray-400 hover:text-gray-600">
                    {el.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>

          <h4 className="text-[10px] font-bold uppercase text-gray-400 mt-5 mb-2">Theme</h4>
          <div className="space-y-2">
            <ColorRow label="Primary" value={primaryColor} onChange={setPrimaryColor} />
            <ColorRow label="Accent" value={accentColor} onChange={setAccentColor} />
            <ColorRow label="Text" value={fontColor} onChange={setFontColor} />
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Header Font</label>
              <select value={headerFont} onChange={e => setHeaderFont(e.target.value)} className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs bg-white">
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Body Font</label>
              <select value={bodyFont} onChange={e => setBodyFont(e.target.value)} className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs bg-white">
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Logo</label>
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                  {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover" /> : null}
                </div>
                <label className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-[10px] cursor-pointer hover:bg-gray-50">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Background</label>
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-md bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                  {backgroundUrl ? <img src={backgroundUrl} className="w-full h-full object-cover" /> : <span className="text-[8px] text-gray-300 flex items-center justify-center w-full h-full">—</span>}
                </div>
                <label className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-[10px] cursor-pointer hover:bg-gray-50">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload
                  <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                </label>
                {backgroundUrl && <button onClick={() => setBackgroundUrl('')} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Sample Photo (preview)</label>
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {samplePhotoUrl ? <img src={samplePhotoUrl} className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-gray-300" />}
                </div>
                <label className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-[10px] cursor-pointer hover:bg-gray-50">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
                {samplePhotoUrl && <button onClick={() => setSamplePhotoUrl('')} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
              </div>
            </div>
          </div>
        </div>

        {/* Center: canvas */}
        <div className="order-1 md:order-2 flex-1 flex items-center justify-center p-4 sm:p-6 overflow-auto kp-scroll-thin bg-gray-100">
          <div className="flex flex-col items-center gap-2">
            <div
              ref={canvasRef}
              className="relative rounded-2xl shadow-2xl overflow-hidden border border-gray-200 select-none"
              style={{ width: cardW, height: cardH, background: backgroundUrl ? `url(${backgroundUrl}) center/cover` : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
              onClick={() => setSelected(null)}
            >
              {/* Header band overlay for contrast */}
              <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: '22%', background: 'linear-gradient(180deg, rgba(0,0,0,0.28), transparent)' }} />
              {Object.keys(ELEMENT_META).map(renderElement)}
            </div>
            <p className="text-xs text-gray-400">Drag elements to reposition · Click to select</p>
          </div>
        </div>

        {/* Right: properties */}
        <div className="order-3 md:order-3 w-full lg:w-64 shrink-0 md:border-l border-t md:border-t-0 border-gray-200 bg-gray-50/60 p-3 overflow-y-auto kp-scroll-thin max-h-[45vh] md:max-h-none">
          {sel && selMeta ? (
            <>
              <h4 className="text-[10px] font-bold uppercase text-gray-400 mb-2">{selMeta.label} Properties</h4>
              <div className="space-y-3">
                <ToggleRow label="Visible" checked={sel.visible} onChange={(v) => updateEl(selected, { visible: v })} />
                {selMeta.type === 'image' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <NumRow label="X %" value={Math.round(sel.x)} onChange={(v) => updateEl(selected, { x: v })} />
                      <NumRow label="Y %" value={Math.round(sel.y)} onChange={(v) => updateEl(selected, { y: v })} />
                      <NumRow label="W %" value={Math.round(sel.w)} onChange={(v) => updateEl(selected, { w: Math.max(3, v) })} />
                      <NumRow label="H %" value={Math.round(sel.h)} onChange={(v) => updateEl(selected, { h: Math.max(3, v) })} />
                    </div>
                    {(selected === 'photo' || selected === 'logo') && (
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Shape</label>
                        <div className="flex gap-1">
                          <button onClick={() => updateEl(selected, { shape: 'circle' })} className={`flex-1 py-1 rounded-md text-[10px] border ${sel.shape === 'circle' ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))]' : 'border-gray-200 text-gray-500'}`}>Circle</button>
                          <button onClick={() => updateEl(selected, { shape: 'square' })} className={`flex-1 py-1 rounded-md text-[10px] border ${sel.shape === 'square' ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))]' : 'border-gray-200 text-gray-500'}`}>Square</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {selMeta.type === 'text' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <NumRow label="X %" value={Math.round(sel.x)} onChange={(v) => updateEl(selected, { x: v })} />
                      <NumRow label="Y %" value={Math.round(sel.y)} onChange={(v) => updateEl(selected, { y: v })} />
                      <NumRow label="W %" value={Math.round(sel.w)} onChange={(v) => updateEl(selected, { w: v })} />
                      <NumRow label="H %" value={Math.round(sel.h)} onChange={(v) => updateEl(selected, { h: v })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Font Size</label>
                      <input type="range" min="6" max="24" value={sel.fontSize} onChange={(e) => updateEl(selected, { fontSize: Number(e.target.value) })} className="w-full" />
                      <span className="text-[10px] text-gray-500">{sel.fontSize}px</span>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Font Family</label>
                      <select value={sel.font || bodyFont} onChange={(e) => updateEl(selected, { font: e.target.value })} className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs bg-white">
                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <ColorRow label="Color" value={sel.color} onChange={(c) => updateEl(selected, { color: c })} />
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Align</label>
                      <div className="flex gap-1">
                        {['left', 'center', 'right'].map(a => (
                          <button key={a} onClick={() => updateEl(selected, { align: a })} className={`flex-1 py-1 rounded-md text-[10px] border capitalize ${sel.align === a ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))]' : 'border-gray-200 text-gray-500'}`}>{a}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <ToggleRow label="Bold" checked={!!sel.bold} onChange={(v) => updateEl(selected, { bold: v })} />
                      <ToggleRow label="Italic" checked={!!sel.italic} onChange={(v) => updateEl(selected, { italic: v })} />
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center mt-8">Select an element to edit its properties.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[10px] text-gray-400 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative w-7 h-7 rounded-full border border-gray-200 overflow-hidden shrink-0">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
          <div className="w-full h-full" style={{ background: value }} />
        </div>
        <span className="text-[10px] text-gray-500 font-mono">{value}</span>
      </div>
    </div>
  );
}

function NumRow({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[10px] text-gray-400 block mb-1">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full px-2 py-1 rounded-md border border-gray-200 text-xs bg-white focus:outline-none" />
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-gray-600">{label}</span>
      <button type="button" onClick={() => onChange(!checked)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-[hsl(var(--kp-green))]' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
}