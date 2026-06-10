/* ============================================================
   SEQUENCES — Timeline (scenes, layer rows, camera, audio)
   ============================================================ */

function Timeline({ state, dispatch }) {
  const { phase, scenes, camera, audio, selectedSceneId, selectedLayerId, frame, ppf, snap } = state;
  const total = window.SEQ.TOTAL;
  const laneW = total * ppf;
  const draft = phase === "picker";
  const bodyRef = React.useRef(null);

  const focusScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];

  // ---- seek by clicking ruler/empty lane ----
  const seekFromX = (clientX, el) => {
    const rect = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(total, Math.round((clientX - rect.left) / ppf)));
    dispatch({ type: "seek", frame: f });
  };

  // ---- playhead drag ----
  const startPlayheadDrag = (e) => {
    e.preventDefault();
    const lane = e.currentTarget.closest(".tl-scroll").querySelector(".ph-ref");
    const move = (ev) => seekFromX(ev.clientX, lane);
    move(e);
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  // ---- scene resize (duration drag) ----
  const startResize = (e, scene, edge) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startDur = scene.dur;
    const startStart = scene.start;
    const move = (ev) => {
      const dFrames = Math.round((ev.clientX - startX) / ppf);
      if (edge === "r") {
        dispatch({ type: "setSceneDur", id: scene.id, dur: Math.max(30, startDur + dFrames) });
      } else {
        const nd = Math.max(30, startDur - dFrames);
        dispatch({ type: "setSceneBounds", id: scene.id, start: startStart + (startDur - nd), dur: nd });
      }
    };
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const playheadLeft = frame * ppf;

  return (
    <div className="panel timeline-panel">
      <div className="tl-toolbar">
        <button className="tl-tool on" title="Select (V)"><Icon name="pointer" size={15} /></button>
        <button className="tl-tool" title="Hand (H)"><Icon name="hand" size={15} /></button>
        <button className="tl-tool" title="Blade (B)"><Icon name="scissors" size={15} /></button>
        <span className="tl-tsep"></span>
        <button className="tl-tool" title="Add scene"><Icon name="plus" size={15} /></button>
        <button className={"tl-tool" + (snap ? " on" : "")} onClick={() => dispatch({ type: "toggleSnap" })} title="Snap to grid / beats"><Icon name="magnet" size={15} /></button>
        <span className="tl-tsep"></span>
        <span style={{ fontSize: 11, color: "var(--text-lo)", fontWeight: 500 }}>
          {scenes.length} scenes · <span className="mono">20.0s</span>
        </span>
        {draft && (
          <span className="tl-draft-tag" style={{ marginLeft: 10 }}>
            <span className="pulse"></span>Draft plan — pick a direction to commit
          </span>
        )}
        <div className="tl-zoom">
          <button className="tl-tool" onClick={() => dispatch({ type: "zoom", d: -0.3 })}><Icon name="minus" size={14} /></button>
          <Icon name="search" size={13} />
          <button className="tl-tool" onClick={() => dispatch({ type: "zoom", d: 0.3 })}><Icon name="plus" size={14} /></button>
        </div>
      </div>

      <div className="tl-body" ref={bodyRef}>
        <div className="tl-scroll" style={{ width: `calc(var(--tl-gutter) + ${laneW}px)` }}>
          {/* ruler */}
          <div className="tl-ruler">
            <div className="gutter"></div>
            <div className="ticks ph-ref" style={{ width: laneW }} onMouseDown={(e) => seekFromX(e.clientX, e.currentTarget)}>
              {Array.from({ length: 21 }).map((_, i) => {
                const f = i * 30;
                const major = i % 5 === 0;
                return (
                  <div key={i} className={"tl-tick" + (major ? " major" : "")} style={{ left: f * ppf }}>
                    {major ? <span>{i}s</span> : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* scenes track */}
          <div className="tl-track tl-scenes-track">
            <div className="tl-gutter-cell">
              <span className="gi"><Icon name="film" size={14} /></span>Scenes
            </div>
            <div className="tl-lane" style={{ width: laneW }} onMouseDown={(e) => { if (e.target.classList.contains("tl-lane")) seekFromX(e.clientX, e.currentTarget); }}>
              {scenes.map((s) => {
                const sel = s.id === selectedSceneId;
                const arc = window.SEQ.ARCHETYPES[s.archetype];
                return (
                  <div key={s.id}
                    className={"tl-scene" + (sel ? " sel" : "") + (draft ? " draft" : "")}
                    style={{ left: s.start * ppf, width: s.dur * ppf - 3 }}
                    onMouseDown={(e) => { if (!e.target.classList.contains("tl-scene-handle")) dispatch({ type: "selectScene", id: s.id }); }}>
                    <div className="tl-scene-top"></div>
                    <div className="tl-scene-body">
                      <span className="tl-scene-ico"><Icon name={arc.icon} size={14} /></span>
                      <div className="tl-scene-meta">
                        <div className="tl-scene-name">{s.name}</div>
                        <div className="tl-scene-dur mono">{(s.dur / 30).toFixed(1)}s · {s.dur}f</div>
                      </div>
                    </div>
                    {sel && !draft && <div className="tl-scene-handle l" onMouseDown={(e) => startResize(e, s, "l")}></div>}
                    {sel && !draft && <div className="tl-scene-handle r" onMouseDown={(e) => startResize(e, s, "r")}></div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* layer rows for focused scene */}
          {focusScene.layers.map((ly, i) => {
            const sel = ly.id === selectedLayerId;
            const mk = MOTION_COLORS[ly.motions[0] && ly.motions[0].group] || "#c0843f";
            return (
              <div key={ly.id} className={"tl-track tl-layer-track" + (i % 2 ? " alt" : "")}>
                <div className="tl-gutter-cell" style={{ paddingLeft: 22 }}>
                  <span className="gi"><Icon name={LAYER_ICON[ly.type]} size={13} /></span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ly.name}</span>
                </div>
                <div className="tl-lane" style={{ width: laneW }}>
                  <div className={"tl-clip clip-" + ly.type + (sel ? " sel" : "")}
                    style={{ left: focusScene.start * ppf, width: focusScene.dur * ppf - 3 }}
                    onMouseDown={() => dispatch({ type: "selectLayer", id: ly.id, sceneId: focusScene.id })}>
                    <span className="tl-clip-label">{ly.name}</span>
                    {ly.motions.map((m, k) => (
                      <span className="tl-mot" key={k}><span className="mk" style={{ background: MOTION_COLORS[m.group] }}></span>{m.primitive}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* camera track */}
          <div className="tl-track tl-layer-track" style={{ height: 30 }}>
            <div className="tl-gutter-cell"><span className="gi"><Icon name="camera" size={13} /></span>Camera</div>
            <div className="tl-lane" style={{ width: laneW }}>
              {camera.map((c) => (
                <div key={c.id} className="tl-clip clip-camera" style={{ left: c.start * ppf, width: c.dur * ppf - 3 }}>
                  <span className="tl-clip-label">cam.{c.move}</span>
                </div>
              ))}
            </div>
          </div>

          {/* audio track */}
          <div className="tl-track tl-layer-track" style={{ height: 34, borderBottom: "none" }}>
            <div className="tl-gutter-cell"><span className="gi"><Icon name="sound" size={13} /></span>Music</div>
            <div className="tl-lane" style={{ width: laneW }}>
              {audio.map((au) => (
                <div key={au.id} className="tl-clip clip-audio" style={{ left: au.start * ppf, width: au.dur * ppf - 3, top: 4, bottom: 4 }}>
                  <span className="tl-clip-label">{au.name}</span>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5, height: 14, overflow: "hidden" }}>
                    {Array.from({ length: 80 }).map((_, i) => (
                      <span key={i} style={{ flex: 1, height: `${20 + Math.abs(Math.sin(i * 1.3)) * 70 + (i % 4) * 6}%`, background: "rgba(255,255,255,0.16)", borderRadius: 1 }}></span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* playhead overlay */}
          <div className="tl-playhead" style={{ left: `calc(var(--tl-gutter) + ${playheadLeft}px)` }}></div>
          <div className="tl-playhead-hit" style={{ left: `calc(var(--tl-gutter) + ${playheadLeft}px)` }} onMouseDown={startPlayheadDrag}></div>
        </div>
      </div>
    </div>
  );
}

const MOTION_COLORS = { enter: "#7ba0c0", exit: "#c08f6f", emphasis: "#c0843f", continuous: "#8aa074" };

Object.assign(window, { Timeline, MOTION_COLORS });
