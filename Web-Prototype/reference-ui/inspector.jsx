/* ============================================================
   SEQUENCES — Inspector (project/brand + layer motion editor)
   ============================================================ */

function Inspector({ state, dispatch }) {
  const { phase, scenes, selectedLayerId, selectedSceneId } = state;
  let layer = null, scene = null;
  if (selectedLayerId) {
    for (const s of scenes) {
      const l = s.layers.find((x) => x.id === selectedLayerId);
      if (l) { layer = l; scene = s; break; }
    }
  }

  return (
    <div className="panel inspector-panel">
      <div className="panel-head">
        <span className="ph-title">Inspector</span>
        <span className="ph-sub" style={{ marginLeft: 2 }}>
          {layer ? "Layer" : phase === "picker" ? "Project" : "Scene"}
        </span>
        <div className="ph-tools">
          <button className="mini-btn" title="Properties"><Icon name="sliders" size={13} /></button>
        </div>
      </div>
      <div className="insp-body">
        {layer ? <LayerInspector layer={layer} scene={scene} dispatch={dispatch} state={state} />
               : <ProjectInspector state={state} dispatch={dispatch} />}
      </div>
    </div>
  );
}

/* ---------- PROJECT / BRAND / PROFILE ---------- */
function ProjectInspector({ state, dispatch }) {
  const { profile, scenes, phase } = state;
  const B = window.SEQ.BRAND;
  return (
    <div>
      {/* composition */}
      <div className="insp-section">
        <div className="insp-sec-head"><span className="t">Composition</span></div>
        <div className="insp-sec-body">
          <div className="row2">
            <Field label="Format"><div className="input" style={{ display: "flex", alignItems: "center" }}>1920 × 1080</div></Field>
            <Field label="Frame rate"><div className="input mono" style={{ display: "flex", alignItems: "center" }}>30 fps</div></Field>
          </div>
          <Field label="Duration" hint="600f">
            <div className="input mono" style={{ display: "flex", alignItems: "center" }}>00:20:00</div>
          </Field>
        </div>
      </div>

      {/* brand kit */}
      <div className="insp-section">
        <div className="insp-sec-head"><span className="t">Brand kit · {B.name}</span><span className="x"><Icon name="lock" size={13} /></span></div>
        <div className="insp-sec-body">
          <div className="brand-grid">
            {B.colors.map((c) => (
              <div className="brand-tok" key={c.id}>
                <span className="sw" style={{ background: c.hex }}></span>
                <div className="bt-meta">
                  <div className="bt-name">{c.name}</div>
                  <div className="bt-hex mono">{c.hex}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {B.fonts.map((f, i) => (
              <div className="font-tok" key={i}>
                <span className="ft-role">{f.role}</span>
                <span className="ft-name">{f.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-lo)" }}>{f.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* motion profile */}
      <div className="insp-section">
        <div className="insp-sec-head"><span className="t">Motion profile</span><span className="x mono" style={{ fontSize: 10 }}>selection bias</span></div>
        <div className="insp-sec-body">
          <div className="profile-list">
            {Object.values(window.SEQ.PROFILES).map((p) => (
              <div key={p.id} className={"profile-opt" + (p.id === profile ? " on" : "")}
                onClick={() => dispatch({ type: "setProfile", id: p.id })}>
                <span className="po-sw">{p.swatches.map((s, i) => <i key={i} style={{ background: s }}></i>)}</span>
                <div className="po-meta">
                  <div className="po-name">{p.name}</div>
                  <div className="po-desc">{p.desc}</div>
                </div>
                {p.id === profile && <span className="po-check"><Icon name="check" size={15} /></span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* plan / beat sheet */}
      <div className="insp-section" style={{ borderBottom: "none" }}>
        <div className="insp-sec-head"><span className="t">{phase === "picker" ? "Proposed beat sheet" : "Scenes"}</span><span className="x mono" style={{ fontSize: 10 }}>{scenes.length} beats</span></div>
        <div className="insp-sec-body" style={{ gap: 4 }}>
          {scenes.map((s, i) => {
            const arc = window.SEQ.ARCHETYPES[s.archetype];
            return (
              <div key={s.id} onClick={() => dispatch({ type: "selectScene", id: s.id })}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 6, cursor: "pointer",
                  background: s.id === state.selectedSceneId ? "var(--accent-soft)" : "transparent" }}>
                <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)", width: 14 }}>{i + 1}</span>
                <span style={{ color: "var(--accent-hi)", display: "grid", placeItems: "center" }}><Icon name={arc.icon} size={14} /></span>
                <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--text-lo)" }}>{(s.dur / 30).toFixed(1)}s</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- LAYER MOTION EDITOR ---------- */
const SIZE_TOKENS = [
  { id: "label", val: "13" }, { id: "caption", val: "16" }, { id: "body", val: "18" },
  { id: "h2", val: "38" }, { id: "h1", val: "64" }, { id: "display", val: "120" },
];
const ANCHORS = ["left", "center", "right"];

function LayerInspector({ layer, scene, dispatch, state }) {
  const D = window.SEQ;
  const colorOpts = D.BRAND.colors.map((c) => ({ id: c.id, label: c.name, hex: c.hex }));
  const primOpts = [...D.PRIMITIVES.enter, ...D.PRIMITIVES.exit, ...D.PRIMITIVES.emphasis, ...D.PRIMITIVES.continuous]
    .map((p) => ({ id: p.id, label: p.label, desc: p.desc, ico: "zap" }));

  return (
    <div>
      <div className="layer-id-head">
        <span className="layer-id-ico" style={{ background: clipBg(layer.type) }}><Icon name={LAYER_ICON[layer.type]} size={16} /></span>
        <div className="layer-id-meta" style={{ flex: 1 }}>
          <div className="nm">{layer.name}</div>
          <div className="ty mono">{layer.type} · {scene.name} · track {layer.track}</div>
        </div>
        <button className="mini-btn" title="Hide"><Icon name="eye" size={14} /></button>
        <button className="mini-btn" title="Lock"><Icon name="lock" size={14} /></button>
      </div>

      {/* content */}
      {(layer.type === "text") && (
        <div className="insp-section">
          <div className="insp-sec-head"><span className="t">Content</span><span className="x mono" style={{ fontSize: 10 }}>≤ 7 words</span></div>
          <div className="insp-sec-body">
            <textarea className="input" rows={2} value={layer.content}
              onChange={(e) => dispatch({ type: "setText", id: layer.id, content: e.target.value })} />
          </div>
        </div>
      )}
      {(layer.type === "device" || layer.type === "image") && (
        <div className="insp-section">
          <div className="insp-sec-head"><span className="t">Source</span></div>
          <div className="insp-sec-body">
            <div className="select"><div className="sv"><span className="pico"><Icon name="image" size={14} /></span><span className="mono" style={{ fontSize: 12 }}>{layer.content}</span></div><span className="chev"><Icon name="swap" size={14} /></span></div>
          </div>
        </div>
      )}

      {/* transform */}
      <div className="insp-section">
        <div className="insp-sec-head"><span className="t">Transform</span><span className="x mono" style={{ fontSize: 10 }}>12-col · snapped</span></div>
        <div className="insp-sec-body">
          <div className="row4">
            {[["X", layer.box.x], ["Y", layer.box.y], ["W", layer.box.w], ["H", layer.box.h]].map(([k, v]) => (
              <div className="num-field" key={k}><span className="nlab">{k}</span><input className="input" defaultValue={v} /></div>
            ))}
          </div>
          <Field label="Transform origin (anchor)">
            <div className="token-pick">
              {ANCHORS.map((a) => (
                <button key={a} className={"token-pill" + (layer.box.anchor === a ? " on" : "")}
                  onClick={() => dispatch({ type: "setAnchor", id: layer.id, anchor: a })}>{a}</button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {/* style */}
      {layer.type === "text" && (
        <div className="insp-section">
          <div className="insp-sec-head"><span className="t">Type & color</span></div>
          <div className="insp-sec-body">
            <div className="row2">
              <Field label="Font">
                <Select value={layer.style.font === "Display" ? "disp" : "body"} leadIcon="text"
                  options={[{ id: "disp", label: "Geist Display" }, { id: "body", label: "Geist Body" }]}
                  onChange={() => {}} renderValue={(o) => <span style={{ fontSize: 12.5 }}>{o.label}</span>} />
              </Field>
              <Field label="Size token">
                <Select value={layer.style.size} options={SIZE_TOKENS.map((s) => ({ id: s.id, label: s.id, desc: s.val + "px" }))}
                  onChange={(id) => dispatch({ type: "setSize", id: layer.id, size: id })}
                  renderValue={(o) => <span className="mono" style={{ fontSize: 12 }}>{o.id}</span>} />
              </Field>
            </div>
            <Field label="Color (brand token)">
              <div className="token-pick">
                {colorOpts.map((c) => (
                  <button key={c.id} className={"token-pill" + (layer.style.color === c.id ? " on" : "")}
                    onClick={() => dispatch({ type: "setColor", id: layer.id, color: c.id })}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: c.hex, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}></span>{c.id}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>
      )}

      {/* MOTION */}
      <div className="insp-section">
        <div className="insp-sec-head"><span className="t">Motion</span><span className="x mono" style={{ fontSize: 10 }}>{layer.motions.length} · token-bound</span></div>
        <div className="insp-sec-body" style={{ gap: 9 }}>
          {layer.motions.map((m, idx) => (
            <MotionCard key={idx} layer={layer} idx={idx} motion={m} primOpts={primOpts} dispatch={dispatch} />
          ))}
          <div className="add-motion"><Icon name="plus" size={14} /> Add motion</div>
        </div>
      </div>

      {/* choreography */}
      <div className="insp-section" style={{ borderBottom: "none" }}>
        <div className="insp-sec-head"><span className="t">Scene choreography</span><span className="x mono" style={{ fontSize: 10 }}>solver</span></div>
        <div className="insp-sec-body">
          <Field label="Entrance order">
            <Select value="reading" options={[{ id: "reading", label: "Reading order" }, { id: "hierarchy", label: "Visual hierarchy" }, { id: "custom", label: "Custom" }]}
              onChange={() => {}} renderValue={(o) => <span style={{ fontSize: 12.5 }}>{o.label}</span>} />
          </Field>
          <Field label="Stagger">
            <TokenPick tokens={D.TOKENS.stagger} value={state.choreoStagger} onChange={(id) => dispatch({ type: "setStagger", id })} />
          </Field>
          <Field label="Overlap budget" hint="65%">
            <div className="scrub" style={{ height: 5, marginTop: 5 }}>
              <div className="scrub-fill" style={{ width: "65%" }}></div>
              <div className="scrub-knob" style={{ left: "65%" }}></div>
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

function MotionCard({ layer, idx, motion, primOpts, dispatch }) {
  const [open, setOpen] = React.useState(idx === 0);
  const D = window.SEQ;
  const set = (k, v) => dispatch({ type: "setMotionParam", layerId: layer.id, idx, key: k, value: v });
  return (
    <div className="motion-card">
      <div className="motion-card-head" onClick={() => setOpen((o) => !o)}>
        <span className="mc-at">{motion.at}</span>
        <span className="mc-name"><b>{motion.primitive}</b></span>
        <div className="mc-tools">
          <button className="mini-btn" title="Swap"><Icon name="swap" size={13} /></button>
          <button className="mini-btn" title="Remove"><Icon name="trash" size={13} /></button>
          <button className="mini-btn"><Icon name={open ? "chevDown" : "chevRight"} size={13} /></button>
        </div>
      </div>
      {open && (
        <div className="motion-card-body">
          <Field label="Primitive">
            <Select value={motion.primitive} options={primOpts} onChange={(v) => set("primitive", v)}
              renderValue={(o) => <span className="mono" style={{ fontSize: 12 }}>{o.label}</span>} leadIcon="zap" />
          </Field>
          <Field label="Duration"><TokenPick tokens={D.TOKENS.duration} value={motion.duration} onChange={(v) => set("duration", v)} /></Field>
          <Field label={`Easing (${motion.group})`}><TokenPick tokens={D.TOKENS.easeEnter} value={motion.ease} onChange={(v) => set("ease", v)} /></Field>
          {motion.distance && <Field label="Distance"><TokenPick tokens={D.TOKENS.distance} value={motion.distance} onChange={(v) => set("distance", v)} /></Field>}
        </div>
      )}
    </div>
  );
}

function clipBg(t) {
  return { text: "linear-gradient(180deg,#2f3a44,#243038)", image: "linear-gradient(180deg,#3a3326,#2c271d)",
    device: "linear-gradient(180deg,#38293a,#2a2030)", shape: "linear-gradient(180deg,#2c3a30,#212c25)",
    group: "linear-gradient(180deg,#3a3030,#2a2222)" }[t] || "var(--bg-3)";
}

Object.assign(window, { Inspector });
