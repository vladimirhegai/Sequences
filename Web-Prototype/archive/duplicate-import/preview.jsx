/* ============================================================
   SEQUENCES — Preview viewport + transport + composed frames
   ============================================================ */

/* ---- composed scene renderers (use cqw/cqh so they scale with stage) ---- */
function SceneRender({ scene, accent }) {
  const a = scene.archetype || scene.kind;
  if (a === "hook-opener" || a === "hook") {
    return (
      <div className="sf-pad" style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <div className="sf-eyebrow" style={{ fontSize: "2.1cqw", color: accent, marginBottom: "2.6cqh" }}>
          Northwind Analytics
        </div>
        <div className="sf-head" style={{ fontSize: "8.2cqw" }}>
          Stop guessing.<br />Start seeing.
        </div>
      </div>
    );
  }
  if (a === "feature-reveal" || a === "feature") {
    return (
      <div className="sf-pad" style={{ flexDirection: "row", alignItems: "center", gap: "5cqw" }}>
        <div style={{ flex: "0 0 44%", display: "flex", flexDirection: "column", gap: "2.6cqh" }}>
          <div className="sf-eyebrow" style={{ fontSize: "1.7cqw", color: accent }}>The product</div>
          <div className="sf-head" style={{ fontSize: "5cqw" }}>Dashboards that explain themselves</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.6cqh", marginTop: "1cqh" }}>
            {["Live boards, zero setup", "Anomalies surfaced for you", "Share a link, not a spreadsheet"].map((b, i) => (
              <div className="bullet-row" key={i} style={{ fontSize: "1.9cqw" }}>
                <span className="bdot" style={{ background: accent }}></span>{b}
              </div>
            ))}
          </div>
        </div>
        <div className="ph-shot" data-label="product shot" style={{ flex: 1, height: "72%", borderColor: "rgba(255,255,255,.08)" }}>
          <div className="ph-chrome"><i></i><i></i><i></i></div>
        </div>
      </div>
    );
  }
  if (a === "stat-callout" || a === "stat") {
    return (
      <div className="sf-pad" style={{ justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <div className="stat-num" style={{ fontSize: "17cqw" }}><em style={{ color: accent }}>3.2×</em></div>
        <div className="sf-sub" style={{ fontSize: "2.4cqw", marginTop: "1.5cqh", letterSpacing: ".02em" }}>
          faster time to insight
        </div>
      </div>
    );
  }
  if (a === "ui-walkthrough" || a === "walkthrough") {
    return (
      <div className="sf-pad" style={{ padding: "5% 6%" }}>
        <div className="ph-shot" data-label="app screen · dashboard.png" style={{ flex: 1, width: "100%" }}>
          <div className="ph-chrome"><i></i><i></i><i></i></div>
          {/* callout tooltip */}
          <div style={{ position: "absolute", left: "16%", top: "34%", display: "flex", alignItems: "center", gap: "1cqw" }}>
            <div style={{ width: "2.2cqw", height: "2.2cqw", borderRadius: "50%", border: `2px solid ${accent}`, boxShadow: `0 0 0 4px ${accent}33` }}></div>
            <div style={{ background: accent, color: "#1c1206", fontSize: "1.5cqw", fontWeight: 650, padding: ".7cqh 1.1cqw", borderRadius: "1cqw" }}>Smart filters</div>
          </div>
        </div>
      </div>
    );
  }
  if (a === "social-proof" || a === "social") {
    return (
      <div className="sf-pad" style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: "3cqh" }}>
        <div className="sf-sub" style={{ fontSize: "2.2cqw" }}>Trusted by fast-moving teams</div>
        <div className="logo-row" style={{ gap: "3cqw" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div className="logo-chip" key={i} style={{ width: "9cqw", height: "2.8cqh" }}></div>
          ))}
        </div>
      </div>
    );
  }
  // logo-sting-cta
  return (
    <div className="sf-pad" style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: "3cqh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.4cqw" }}>
        <div style={{ width: "4.5cqw", height: "4.5cqw", borderRadius: "1.2cqw", background: `linear-gradient(150deg, ${accent}, #8a5d2b)` }}></div>
        <div className="sf-head" style={{ fontSize: "5cqw" }}>Northwind</div>
      </div>
      <div className="sf-sub" style={{ fontSize: "2.1cqw", color: accent, fontWeight: 600 }}>northwind.app →</div>
    </div>
  );
}

function Viewport({ state, dispatch }) {
  const { phase, scenes, selectedSceneId, directions, activeDirection, frame, playing, safeArea } = state;
  const total = window.SEQ.TOTAL;

  // what to show in the stage
  let stageScene, accent, badgeLabel;
  if (phase === "picker") {
    const dir = directions.find((d) => d.id === activeDirection);
    stageScene = { archetype: dir.opener };
    accent = dir.accent;
    badgeLabel = `Previewing · Direction ${dir.id}`;
  } else {
    let sc;
    if (playing) sc = scenes.find((s) => frame >= s.start && frame < s.start + s.dur);
    sc = sc || scenes.find((s) => s.id === selectedSceneId) || scenes[0];
    stageScene = sc;
    accent = "#c0843f";
    badgeLabel = `${window.SEQ.ARCHETYPES[sc.archetype].name}`;
  }

  const tc = framesToTC(frame);
  const pct = (frame / total) * 100;

  const onScrub = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    dispatch({ type: "seek", frame: Math.round(p * total) });
  };

  return (
    <div className="panel viewport-panel">
      <div className="panel-head">
        <span className="ph-title">Preview</span>
        <span className="ph-sub mono" style={{ marginLeft: 2 }}>1920×1080 · 30fps</span>
        <div className="ph-tools">
          <button className={"mini-btn" + (safeArea ? " on" : "")} onClick={() => dispatch({ type: "toggleSafe" })} title="Title-safe guides">
            <Icon name="grid" size={13} /> Safe
          </button>
          <button className="mini-btn" title="Fit to panel"><Icon name="fit" size={13} /></button>
        </div>
      </div>

      <div className="viewport-wrap">
        <div className="viewport-grid-fade"></div>
        <div className="stage">
          <div className="stage-badge"><span className="dot" style={{ background: accent }}></span>{badgeLabel}</div>
          <div className={"scene-frame fade-key"} key={phase === "picker" ? activeDirection : selectedSceneId}
            style={{ background: "radial-gradient(120% 120% at 70% 10%, #1a160f 0%, #0d0b08 70%)" }}>
            <SceneRender scene={stageScene} accent={accent} />
          </div>
          <div className={"stage-safe" + (safeArea ? "" : " hidden")}></div>
        </div>
      </div>

      <div className="transport">
        <div className="tp-group">
          <button className="tp-btn" onClick={() => dispatch({ type: "seek", frame: 0 })} title="To start"><Icon name="skipBack" size={16} /></button>
          <button className="tp-btn tp-play" onClick={() => dispatch({ type: "togglePlay" })} title="Play / pause (space)">
            <Icon name={playing ? "pause" : "play"} size={16} />
          </button>
          <button className="tp-btn" onClick={() => dispatch({ type: "seek", frame: total })} title="To end"><Icon name="skipFwd" size={16} /></button>
          <button className="tp-btn" title="Loop"><Icon name="loop" size={16} /></button>
        </div>
        <div className="tc">
          {tc}<span className="sep"> / </span><span className="tc-frames">00:20:00</span>
        </div>
        <div className="scrub-wrap">
          <div className="scrub" onMouseDown={onScrub} onClick={onScrub}>
            <div className="scrub-fill" style={{ width: pct + "%" }}></div>
            <div className="scrub-knob" style={{ left: pct + "%" }}></div>
          </div>
          <span className="tc-frames mono">f{frame}</span>
        </div>
        <span className="res-chip">½ PROXY</span>
      </div>
    </div>
  );
}

function framesToTC(f) {
  const fps = window.SEQ.FPS;
  const totalSec = Math.floor(f / fps);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  const ff = String(f % fps).padStart(2, "0");
  return <span>{mm}<span className="sep">:</span>{ss}<span className="sep">:</span>{ff}</span>;
}

Object.assign(window, { Viewport, SceneRender, framesToTC });
