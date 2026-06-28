/* Tiny React-compatible runtime for Forge Stage previews.
 *
 * This is not a full React replacement. It is a local, dependency-free authoring
 * surface for AI-generated Stage assets: function components, JSX compiled to
 * React.createElement, a small hook subset, and Forge knob integration.
 */
(function () {
  "use strict";
  if (window.ForgeReact && window.React && window.ReactDOM) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const SVG_TAGS = new Set(["svg", "path", "circle", "rect", "line", "polyline", "polygon", "g", "defs", "linearGradient", "stop", "text"]);
  const Fragment = Symbol("ForgeReact.Fragment");

  let rootNode = null;
  let rootComponent = null;
  let hookIndex = 0;
  const hooks = [];
  let effects = [];
  let rendering = false;

  function flatten(items, out) {
    for (const item of items) {
      if (Array.isArray(item)) flatten(item, out);
      else out.push(item);
    }
    return out;
  }

  function createElement(type, props) {
    const children = flatten(Array.prototype.slice.call(arguments, 2), []);
    return { type, props: props || {}, children };
  }

  function depsChanged(prev, next) {
    if (!prev || !next || prev.length !== next.length) return true;
    for (let i = 0; i < next.length; i += 1) {
      if (!Object.is(prev[i], next[i])) return true;
    }
    return false;
  }

  function useState(initial) {
    const index = hookIndex++;
    if (!Object.prototype.hasOwnProperty.call(hooks, index)) {
      hooks[index] = typeof initial === "function" ? initial() : initial;
    }
    const setState = (next) => {
      const value = typeof next === "function" ? next(hooks[index]) : next;
      if (Object.is(value, hooks[index])) return;
      hooks[index] = value;
      scheduleRender();
    };
    return [hooks[index], setState];
  }

  function useRef(initial) {
    const index = hookIndex++;
    if (!hooks[index]) hooks[index] = { current: initial == null ? null : initial };
    return hooks[index];
  }

  function useMemo(factory, deps) {
    const index = hookIndex++;
    const record = hooks[index];
    if (!record || depsChanged(record.deps, deps)) {
      hooks[index] = { deps: deps || null, value: factory() };
    }
    return hooks[index].value;
  }

  function useEffect(fn, deps) {
    const index = hookIndex++;
    const record = hooks[index] || {};
    if (depsChanged(record.deps, deps)) effects.push({ index, fn, previous: record.cleanup });
    hooks[index] = { deps: deps || null, cleanup: record.cleanup };
  }

  function setStyle(el, style) {
    if (!style || typeof style !== "object") return;
    for (const [key, value] of Object.entries(style)) {
      if (value == null) continue;
      if (key.startsWith("--")) el.style.setProperty(key, String(value));
      else el.style[key] = typeof value === "number" && key !== "opacity" && key !== "zIndex" ? `${value}px` : String(value);
    }
  }

  function setProp(el, key, value) {
    if (key === "children" || key === "key") return;
    if (key === "ref" && value && typeof value === "object") {
      value.current = el;
      return;
    }
    if (key === "className") key = "class";
    if (key === "htmlFor") key = "for";
    if (key === "style") {
      setStyle(el, value);
      return;
    }
    if (key === "dangerouslySetInnerHTML" && value && typeof value.__html === "string") {
      el.innerHTML = value.__html;
      return;
    }
    if (/^on[A-Z]/.test(key) && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
      return;
    }
    if (value === false || value == null) return;
    if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, String(value));
  }

  function renderElement(vnode, inSvg) {
    if (vnode == null || vnode === false || vnode === true) return document.createTextNode("");
    if (typeof vnode === "string" || typeof vnode === "number") return document.createTextNode(String(vnode));
    if (Array.isArray(vnode)) {
      const frag = document.createDocumentFragment();
      vnode.forEach((child) => frag.append(renderElement(child, inSvg)));
      return frag;
    }
    if (typeof vnode.type === "function") {
      return renderElement(vnode.type(Object.assign({}, vnode.props, { children: vnode.children })), inSvg);
    }
    if (vnode.type === Fragment) {
      const frag = document.createDocumentFragment();
      vnode.children.forEach((child) => frag.append(renderElement(child, inSvg)));
      return frag;
    }

    const isSvg = inSvg || SVG_TAGS.has(vnode.type);
    const el = isSvg ? document.createElementNS(SVG_NS, vnode.type) : document.createElement(vnode.type);
    for (const [key, value] of Object.entries(vnode.props || {})) setProp(el, key, value);
    if (!(vnode.props && vnode.props.dangerouslySetInnerHTML)) {
      vnode.children.forEach((child) => el.append(renderElement(child, isSvg)));
    }
    return el;
  }

  function syncForgeVars() {
    if (!window.forge || !window.forge.vars) return;
    for (const [name, value] of Object.entries(window.forge.vars)) window.forge.setVar(name, value);
  }

  function flushEffects() {
    const pending = effects;
    effects = [];
    for (const effect of pending) {
      if (typeof effect.previous === "function") {
        try { effect.previous(); } catch (_) {}
      }
      const cleanup = effect.fn();
      hooks[effect.index].cleanup = typeof cleanup === "function" ? cleanup : undefined;
    }
  }

  function renderRoot() {
    if (!rootNode || !rootComponent || rendering) return;
    rendering = true;
    hookIndex = 0;
    const vnode = typeof rootComponent === "function" ? createElement(rootComponent) : rootComponent;
    rootNode.replaceChildren(renderElement(vnode, false));
    rendering = false;
    syncForgeVars();
    flushEffects();
  }

  function scheduleRender() {
    renderRoot();
  }

  function render(component, target) {
    rootNode = typeof target === "string" ? document.getElementById(target) : target;
    rootComponent = component;
    if (!rootNode) throw new Error("Forge React mount node not found");
    renderRoot();
  }

  const React = {
    Fragment,
    createElement,
    useState,
    useEffect,
    useMemo,
    useRef,
  };

  const ReactDOM = {
    createRoot(target) {
      return { render: (component) => render(component, target) };
    },
  };

  const ForgeReact = {
    render,
    useForgeVar(name, fallback) {
      const initial = window.forge && Object.prototype.hasOwnProperty.call(window.forge.vars || {}, name)
        ? window.forge.vars[name]
        : fallback;
      const state = React.useState(initial);
      const value = state[0];
      const setValue = state[1];
      React.useEffect(() => {
        const update = (event) => {
          if (event.detail && event.detail.name === name) setValue(event.detail.value);
        };
        window.addEventListener("forge:var", update);
        if (window.forge && Object.prototype.hasOwnProperty.call(window.forge.vars || {}, name)) {
          setValue(window.forge.vars[name]);
        }
        return () => window.removeEventListener("forge:var", update);
      }, [name]);
      return value;
    },
  };

  window.React = React;
  window.ReactDOM = ReactDOM;
  window.ForgeReact = ForgeReact;
})();
