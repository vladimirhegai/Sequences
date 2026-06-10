/* ============================================================
   SEQUENCES — Agent panel (brief, plan, direction picker, tweaks)
   ============================================================ */

function MiniScene({ dir }) {
  const a = dir.accent;
  const k = dir.scene.kind;
  if (k === "stat") {
    return (
      <div className="mini" style={{ background: dir.scene.bg, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div className="mini-head" style={{ fontSize: 22, color: a }}>3.2×</div>
        <div className="mini-bar" style={{ width: "42%", height: 3, marginTop: 5, background: "rgba(255,255,255,.22)", alignSelf: "center" }}></div>
      </div>
    );
  }
  if (k === "feature") {
    return (
      <div className="mini" style={{ background: dir.scene.bg, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <div style={{ flex: "0 0 46%", display: "flex", flexDirection: "column", gap: 3 }}>
          <div className="mini-eyebrow" style={{ color: a }}>MEET</div>
          <div className="mini-head" style={{ fontSize: 8, color: dir.scene.fg }}>Dashboards that explain.</div>
          <div className="mini-bar" style={{ width: "60%", height: 2.5, background: a, marginTop: 2 }}></div>
        </div>
        <div className="mini-shot" style={{ flex: 1, height: "62%" }}></div>
      </div>
    );
  }
  // hook
  return (
    <div className="mini" style={{ background: dir.scene.bg, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div className="mini-eyebrow" style={{ color: a, marginBottom: 3 }}>NORTHWIND</div>
      <div className="mini-head" style={{ fontSize: 9.5, color: dir.scene.fg }}>Stop guessing.<br />Start seeing.</div>
    </div>
  );
}

function AgentPanel({ state, dispatch }) {
  const { phase, directions, activeDirection, profile, tweakLog, composer, cost } = state;
  const C = window.SEQ.CHAT;
  const bodyRef = React.useRef(null);
  const didInit = React.useRef(false);
  React.useEffect(() => {
    if (!bodyRef.current) return;
    if (!didInit.current) {
      didInit.current = true;
      const card = bodyRef.current.querySelector(".dir-card");
      if (card) bodyRef.current.scrollTop = Math.max(0, card.offsetTop - 52);
      return;
    }
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [tweakLog.length, phase]);

  const send = () => {
    if (!composer.trim()) return;
    dispatch({ type: "sendTweak", text: composer.trim() });
  };

  return (
    <div className="panel agent-panel">
      <div className="panel-head agent-head">
        <span className="agent-spark"><Icon name="sparkle" size={15} /></span>
        <span className="ph-title">Agent</span>
        <span className="ph-sub mono" style={{ marginLeft: 2 }}>claude · BYO key</span>
        <div className="ph-tools">
          <button className="mini-btn"><Icon name="brain" size={13} /> Plan</button>
          <button className="mini-btn" title="History"><Icon name="loop" size={13} /></button>
        </div>
      </div>

      <div className="agent-body" ref={bodyRef}>
        {/* user brief */}
        <div className="msg msg-user">
          <div className="bubble">{C.brief}</div>
          <div className="msg-attach">
            {C.attachments.map((at, i) => at.type === "img"
              ? <div key={i} className="attach-thumb" title={at.label}></div>
              : <span key={i} className="attach-chip"><span style={{ width: 10, height: 10, borderRadius: 2, background: "#c0843f" }}></span>{at.label}</span>)}
          </div>
        </div>

        {/* agent plan */}
        <div className="msg msg-agent">
          <div className="who"><span className="av"><Icon name="sparkle" size={12} /></span>Sequences Agent</div>
          <div className="body-txt">
            Read your brief and <b>2 screenshots</b>. Mapped a <b>6-beat</b> structure to a 20s arc and drafted three directions to compare.
          </div>
          <div className="plan-steps">
            {C.planSteps.map((p, i) => (
              <div key={i} className={"plan-step " + (phase !== "picker" || p.state === "done" ? "done" : p.state)}>
                <span className="ps-ico">
                  {phase !== "picker" || p.state === "done"
                    ? <Icon name="check" size={11} />
                    : p.state === "active" ? <span className="spin"></span> : <Icon name="dot" size={6} />}
                </span>
                {p.label}
              </div>
            ))}
          </div>
        </div>

        {/* direction picker */}
        <div className="msg msg-agent">
          <div className="dir-card">
            <div className="dir-card-head">
              <span className="t">Pick a <b>direction</b></span>
              <span className="sub">{phase === "picker" ? "first scene rendered" : "Direction " + activeDirection + " committed"}</span>
            </div>
            <div className="dir-grid">
              {directions.map((d) => (
                <div key={d.id} className={"dir-opt" + (d.id === activeDirection ? " on" : "")}
                  onClick={() => dispatch({ type: "setDirection", id: d.id })}>
                  <div className="dir-thumb">
                    <span className="dt-tag">{d.id}</span>
                    <MiniScene dir={d} />
                  </div>
                  <div className="dir-meta">
                    <div className="dm-name">{d.name}</div>
                    <div className="dm-prof">{window.SEQ.PROFILES[d.profile].name}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="dir-card-foot">
              {phase === "picker" ? (
                <React.Fragment>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => dispatch({ type: "commit" })}>
                    <Icon name="check" size={15} /> Use Direction {activeDirection}
                  </button>
                  <span className="est">~1 plan call · $0.04</span>
                </React.Fragment>
              ) : (
                <span className="est" style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--good)" }}>
                  <Icon name="check" size={13} /> Committed — assembled 6 scenes, 13 layers
                </span>
              )}
            </div>
          </div>
        </div>

        {/* committed confirmation + tweaks */}
        {phase !== "picker" && (
          <div className="msg msg-agent">
            <div className="who"><span className="av"><Icon name="sparkle" size={12} /></span>Sequences Agent</div>
            <div className="body-txt">
              Assembled <b>Direction {activeDirection}</b> with the <b>{window.SEQ.PROFILES[profile].name}</b> profile. Linter auto-fixed 2 items. Select any layer to fine-tune, or just tell me what to change.
            </div>
          </div>
        )}

        {tweakLog.map((t, i) => (
          <React.Fragment key={i}>
            <div className="msg msg-user"><div className="bubble">{t.text}</div></div>
            <div className="msg msg-agent">
              <div className="who"><span className="av"><Icon name="wand" size={12} /></span>Applied{t.zero ? " · zero-token" : ""}</div>
              <div className="body-txt" dangerouslySetInnerHTML={{ __html: t.reply }}></div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* composer */}
      <div className="agent-foot">
        <div className="quick-tweaks">
          {window.SEQ.QUICK_TWEAKS.map((q, i) => (
            <button key={i} className="qt" onClick={() => dispatch({ type: "quickTweak", label: q.label })}>
              {q.label}{q.zero && <span className="zt">0t</span>}
            </button>
          ))}
        </div>
        <div className="composer">
          <textarea rows={1} placeholder="Describe a change — “make the headline bigger and slow the intro”…"
            value={composer}
            onChange={(e) => dispatch({ type: "setComposer", text: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className={"composer-send" + (composer.trim() ? "" : " dim")} onClick={send}><Icon name="send" size={16} /></button>
        </div>
        <div className="composer-meta">
          <span className="cm-mode"><Icon name="zap" size={12} /> Tweaks route through the command API · scene-scoped</span>
          <span className="cm-cost">project {cost}</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AgentPanel, MiniScene });
