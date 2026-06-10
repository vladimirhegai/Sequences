/* ============================================================
   SEQUENCES — icons + shared UI components
   ============================================================ */
const { useState, useRef, useEffect } = React;

/* ---- ICON SET (simple geometric line icons) ---- */
const ICONS = {
  pointer: <path d="M5 4 L5 18 L9 14 L12 20 L14 19 L11 13 L16 13 Z" fill="currentColor" stroke="none"/>,
  cursorArrow: <path d="M5 4 L5 18 L9 14 L12 20 L14 19 L11 13 L16 13 Z" fill="currentColor" stroke="none"/>,
  hand: <g><path d="M8 11V6.5a1.3 1.3 0 0 1 2.6 0V11"/><path d="M10.6 10.5V5.6a1.3 1.3 0 0 1 2.6 0V11"/><path d="M13.2 11V6.8a1.3 1.3 0 0 1 2.6 0V14a4.5 4.5 0 0 1-4.5 4.5h-1A4 4 0 0 1 6.6 16l-1.4-2.4a1.2 1.2 0 0 1 2-1.3l.8 1"/></g>,
  play: <path d="M7 5 L18 12 L7 19 Z" fill="currentColor" stroke="none"/>,
  pause: <g fill="currentColor" stroke="none"><rect x="7" y="5" width="3.4" height="14" rx="1"/><rect x="13.6" y="5" width="3.4" height="14" rx="1"/></g>,
  skipBack: <g><path d="M16 6 L9 12 L16 18 Z" fill="currentColor" stroke="none"/><line x1="7" y1="5" x2="7" y2="19"/></g>,
  skipFwd: <g><path d="M8 6 L15 12 L8 18 Z" fill="currentColor" stroke="none"/><line x1="17" y1="5" x2="17" y2="19"/></g>,
  loop: <g><path d="M5 9a7 7 0 0 1 12-3l1.5 1.5"/><path d="M19 6v3.5h-3.5"/><path d="M19 15a7 7 0 0 1-12 3L5.5 16.5"/><path d="M5 18v-3.5h3.5"/></g>,
  fit: <g><path d="M5 8.5V5h3.5"/><path d="M19 8.5V5h-3.5"/><path d="M5 15.5V19h3.5"/><path d="M19 15.5V19h-3.5"/></g>,
  plus: <g><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></g>,
  minus: <line x1="6" y1="12" x2="18" y2="12"/>,
  chevDown: <path d="M7 10 L12 15 L17 10"/>,
  chevRight: <path d="M10 7 L15 12 L10 17"/>,
  check: <path d="M5 12.5 L10 17 L19 7"/>,
  x: <g><line x1="7" y1="7" x2="17" y2="17"/><line x1="17" y1="7" x2="7" y2="17"/></g>,
  search: <g><circle cx="11" cy="11" r="6"/><line x1="15.5" y1="15.5" x2="19" y2="19"/></g>,
  undo: <g><path d="M8 8H15a4 4 0 0 1 0 8H9"/><path d="M8 8 5 5.5M8 8 5 10.5" /><path d="M8 8 11 5.5M8 8 11 10.5" fill="none" stroke="none"/></g>,
  redo: <g><path d="M16 8H9a4 4 0 0 0 0 8h6"/><path d="M16 8 13 5.5M16 8 13 10.5"/></g>,
  bolt: <path d="M13 4 L6 13 L11 13 L10 20 L17 10 L12 10 Z" fill="currentColor" stroke="none"/>,
  sparkle: <path d="M12 4 L13.4 10.6 L20 12 L13.4 13.4 L12 20 L10.6 13.4 L4 12 L10.6 10.6 Z" fill="currentColor" stroke="none"/>,
  sparkleLine: <path d="M12 4 L13.4 10.6 L20 12 L13.4 13.4 L12 20 L10.6 13.4 L4 12 L10.6 10.6 Z"/>,
  device: <g><rect x="8" y="4" width="8" height="16" rx="2"/><line x1="11" y1="17.5" x2="13" y2="17.5"/></g>,
  stat: <g><line x1="6" y1="19" x2="6" y2="11"/><line x1="12" y1="19" x2="12" y2="6"/><line x1="18" y1="19" x2="18" y2="14"/></g>,
  quote: <g><path d="M6 14c0-3 1.5-5 4-5.5"/><path d="M6 14h3v3.5H6z" fill="currentColor" stroke="none"/><path d="M13 14c0-3 1.5-5 4-5.5"/><path d="M13 14h3v3.5h-3z" fill="currentColor" stroke="none"/></g>,
  text: <g><path d="M6 7h12"/><line x1="12" y1="7" x2="12" y2="18"/><path d="M9.5 7V5.5h5V7"/></g>,
  image: <g><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4 3 2.5L16 11l3 4"/></g>,
  shape: <rect x="6" y="6" width="12" height="12" rx="2" transform="rotate(0 12 12)"/>,
  diamond: <path d="M12 4 L20 12 L12 20 L4 12 Z"/>,
  group: <g><rect x="5" y="5" width="10" height="10" rx="2"/><path d="M9 19h8a2 2 0 0 0 2-2V9"/></g>,
  layers: <g><path d="M12 4 L20 8.5 L12 13 L4 8.5 Z"/><path d="M4 13 L12 17.5 L20 13"/></g>,
  eye: <g><path d="M3.5 12S6.5 6.5 12 6.5 20.5 12 20.5 12 17.5 17.5 12 17.5 3.5 12 3.5 12Z"/><circle cx="12" cy="12" r="2.3"/></g>,
  lock: <g><rect x="6" y="11" width="12" height="8" rx="2"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11"/></g>,
  camera: <g><rect x="3.5" y="7" width="12" height="10" rx="2"/><path d="M15.5 10.5 20.5 7.5v9l-5-3z"/></g>,
  sound: <g><line x1="5" y1="12" x2="5" y2="14"/><line x1="8" y1="9" x2="8" y2="17"/><line x1="11" y1="6" x2="11" y2="20"/><line x1="14" y1="10" x2="14" y2="16"/><line x1="17" y1="8" x2="17" y2="18"/><line x1="20" y1="11" x2="20" y2="15"/></g>,
  magnet: <g><path d="M6 5v6a6 6 0 0 0 12 0V5"/><line x1="6" y1="9" x2="10" y2="9"/><line x1="14" y1="9" x2="18" y2="9"/></g>,
  scissors: <g><circle cx="7" cy="7" r="2"/><circle cx="7" cy="17" r="2"/><line x1="8.6" y1="8.4" x2="19" y2="17"/><line x1="8.6" y1="15.6" x2="19" y2="7"/></g>,
  sliders: <g><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="9" cy="8" r="2.2" fill="var(--bg-1)"/><circle cx="15" cy="16" r="2.2" fill="var(--bg-1)"/></g>,
  swap: <g><path d="M5 9h11l-2.5-2.5M16 9l-2.5 2.5"/><path d="M19 15H8l2.5-2.5M8 15l2.5 2.5"/></g>,
  trash: <g><path d="M6 7h12"/><path d="M9 7V5.5h6V7"/><path d="M7.5 7l.7 11a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4L16.5 7"/></g>,
  download: <g><path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></g>,
  film: <g><rect x="4" y="5" width="16" height="14" rx="2"/><line x1="8.5" y1="5" x2="8.5" y2="19"/><line x1="15.5" y1="5" x2="15.5" y2="19"/><line x1="4" y1="12" x2="20" y2="12"/></g>,
  grid: <g><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></g>,
  wand: <g><path d="M5 19 L15 9"/><path d="M16 4l.7 1.8L18.5 6.5 16.7 7.2 16 9l-.7-1.8L13.5 6.5l1.8-.7z" fill="currentColor" stroke="none"/></g>,
  send: <path d="M5 12h11M11 7l5 5-5 5"/>,
  brain: <path d="M12 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.5A2.7 2.7 0 0 0 10 18a2.5 2.5 0 0 0 2 1 2.5 2.5 0 0 0 2-1 2.7 2.7 0 0 0 2.5-5A3 3 0 0 0 15 7.5a3 3 0 0 0-3-3Z"/>,
  zap: <path d="M13 4 L6 13 L11 13 L10 20 L17 10 L12 10 Z" fill="currentColor" stroke="none"/>,
  ruler: <g><rect x="4" y="8" width="16" height="8" rx="1.5"/><line x1="8" y1="8" x2="8" y2="11"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="16" y1="8" x2="16" y2="11"/></g>,
  dot: <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>,
};

function Icon({ name, size = 18, stroke = 1.6, style, className }) {
  const node = ICONS[name] || ICONS.dot;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", ...style }} className={className} aria-hidden="true">
      {node}
    </svg>
  );
}

const LAYER_ICON = { text: "text", image: "image", device: "device", shape: "diamond", group: "group", video: "film", camera: "camera", audio: "sound" };

/* ---- Dropdown / Select ---- */
function Select({ value, options, onChange, renderValue, leadIcon, width }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const cur = options.find((o) => o.id === value) || options[0];
  return (
    <div className={"select" + (open ? " open" : "")} ref={ref} style={{ width }} onClick={() => setOpen((o) => !o)}>
      <div className="sv">
        {leadIcon && <span className="pico"><Icon name={leadIcon} size={14} /></span>}
        {renderValue ? renderValue(cur) : <span className="mono">{cur && cur.label}</span>}
      </div>
      <span className="chev"><Icon name="chevDown" size={14} /></span>
      {open && (
        <div className="select-menu" onClick={(e) => e.stopPropagation()}>
          {options.map((o) => (
            <div key={o.id} className={"select-opt" + (o.id === value ? " sel" : "")}
              onClick={() => { onChange(o.id); setOpen(false); }}>
              {o.ico && <span className="so-ico"><Icon name={o.ico} size={14} /></span>}
              <div className="so-main">
                <div className="so-name"><span className="mono">{o.label}</span></div>
                {o.desc && <div className="so-desc">{o.desc}</div>}
              </div>
              {o.id === value && <span className="so-check"><Icon name="check" size={14} /></span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Token picker (segmented pills) ---- */
function TokenPick({ tokens, value, onChange }) {
  return (
    <div className="token-pick">
      {tokens.map((t) => (
        <button key={t.id} className={"token-pill" + (t.id === value ? " on" : "")}
          onClick={() => onChange(t.id)}>
          {t.id}<span className="tval">{t.val}</span>
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <div className="field-label">{label}{hint && <span className="hint">{hint}</span>}</div>}
      {children}
    </div>
  );
}

Object.assign(window, { Icon, ICONS, LAYER_ICON, Select, TokenPick, Field });
