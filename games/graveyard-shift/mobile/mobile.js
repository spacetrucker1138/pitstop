/* GRAVEYARD SHIFT — mobile layer.
 * Only switches on for touch screens; desktop is untouched.
 *  - Floating joystick: put a thumb down anywhere (on the game, or below it in portrait) and drag to steer.
 *  - ❚❚ pause, MAP and ZOOM buttons along the top edge, plus fullscreen where the browser allows it.
 *  - Pinch with two fingers to zoom in/out.
 *  - Adds body classes so style.css can fit the game to the phone screen. */
(() => {
  "use strict";
  const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const G = window.GS_MOBILE;
  if (!isTouch || !G) return;

  const body = document.body,
    frame = document.querySelector(".game-frame");
  body.classList.add("touch");

  // ---- on-screen buttons ----
  const bar = document.createElement("div");
  bar.className = "touch-bar";
  const mkBtn = (label, title, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "touch-btn";
    b.textContent = label;
    b.setAttribute("aria-label", title);
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn(b);
    });
    bar.appendChild(b);
    return b;
  };
  const pauseBtn = mkBtn("❚❚", "Pause", () => G.pause());
  const mapBtn = mkBtn("MAP", "Toggle map", (b) => b.classList.toggle("on", G.toggleMap()));
  mkBtn("ZOOM", "Zoom out / in", () => G.zoomCycle && G.zoomCycle());
  const root = document.documentElement;
  const fsReq = root.requestFullscreen || root.webkitRequestFullscreen;
  if (fsReq) {
    const fsBtn = mkBtn("⛶", "Fullscreen", () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const p = fsReq.call(root);
        if (p && p.then) p.then(() => screen.orientation?.lock?.("landscape").catch(() => {})).catch(() => {});
      }
    });
    fsBtn.classList.add("fs");
  }
  frame.appendChild(bar);

  // ---- floating joystick ----
  const RADIUS = 56, // px the knob can travel from where the thumb landed
    DEAD = 0.18;
  const stick = document.createElement("div");
  stick.className = "touch-stick";
  stick.innerHTML = '<div class="touch-knob"></div>';
  body.appendChild(stick);
  const knob = stick.firstElementChild;
  let active = null; // { id, x0, y0 }
  // two-finger pinch zoom: fingers together = zoom out (see more), apart = zoom in
  const pts = new Map();
  let pinch = null; // { a, b, d0 }
  const pdist = () => {
    const [p1, p2] = [pts.get(pinch.a), pts.get(pinch.b)];
    return p1 && p2 ? Math.hypot(p1.x - p2.x, p1.y - p2.y) : 0;
  };
  document.addEventListener("pointerdown", (e) => e.pointerType !== "mouse" && pts.set(e.pointerId, { x: e.clientX, y: e.clientY }), { capture: true });
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse" || G.mode !== "playing" || pinch || pts.size < 2) return;
      const ids = [...pts.keys()].slice(-2);
      pinch = { a: ids[0], b: ids[1], d0: 0 };
      pinch.d0 = pdist();
      if (active) release(); // a second finger means pinch, not steering
      e.preventDefault();
    },
    { capture: true, passive: false },
  );
  document.addEventListener(
    "pointermove",
    (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinch || (e.pointerId !== pinch.a && e.pointerId !== pinch.b)) return;
      e.preventDefault();
      const d = pdist();
      if (pinch.d0 > 0 && d > 0) {
        if (d / pinch.d0 < 0.8) (G.zoomStep(1), (pinch.d0 = d));
        else if (d / pinch.d0 > 1.25) (G.zoomStep(-1), (pinch.d0 = d));
      }
    },
    { capture: true, passive: false },
  );
  const ptEnd = (e) => {
    pts.delete(e.pointerId);
    if (pinch && (e.pointerId === pinch.a || e.pointerId === pinch.b)) pinch = null;
  };
  document.addEventListener("pointerup", ptEnd, { capture: true });
  document.addEventListener("pointercancel", ptEnd, { capture: true });

  function release() {
    active = null;
    stick.classList.remove("visible");
    G.setMove(0, 0, 0);
  }
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (active || pinch || G.mode !== "playing" || e.pointerType === "mouse") return;
      if (e.target.closest(".touch-btn, button, input, a, .panel.visible")) return;
      e.preventDefault();
      active = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
      stick.style.left = e.clientX + "px";
      stick.style.top = e.clientY + "px";
      knob.style.transform = "translate(-50%,-50%)";
      stick.classList.add("visible");
    },
    { passive: false },
  );
  document.addEventListener(
    "pointermove",
    (e) => {
      if (!active || e.pointerId !== active.id) return;
      e.preventDefault();
      let dx = e.clientX - active.x0,
        dy = e.clientY - active.y0;
      const d = Math.hypot(dx, dy);
      if (d > RADIUS) {
        // Drag past the edge: the base follows the thumb, so you never "run out" of stick.
        active.x0 += (dx / d) * (d - RADIUS);
        active.y0 += (dy / d) * (d - RADIUS);
        stick.style.left = active.x0 + "px";
        stick.style.top = active.y0 + "px";
        dx = e.clientX - active.x0;
        dy = e.clientY - active.y0;
      }
      const len = Math.min(RADIUS, Math.hypot(dx, dy));
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const m = len / RADIUS;
      if (m < DEAD) G.setMove(0, 0, 0);
      else G.setMove(dx / (len || 1), dy / (len || 1), Math.min(1, (m - DEAD) / (1 - DEAD) * 1.25)); // full speed before the rim
    },
    { passive: false },
  );
  const end = (e) => {
    if (active && e.pointerId === active.id) release();
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  // Stop iOS long-press menus / double-tap zoom from hijacking gameplay touches.
  document.addEventListener("contextmenu", (e) => G.mode === "playing" && e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 320 && !e.target.closest("input")) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false },
  );

  // ---- keep classes/buttons in sync with the game's mode ----
  let lastMode = "";
  (function sync() {
    const mode = G.mode;
    if (mode !== lastMode) {
      const playing = mode === "playing";
      body.classList.toggle("playing", playing);
      body.dataset.mode = mode;
      if (!playing) {
        if (active) release();
        if (mapBtn.classList.contains("on")) mapBtn.classList.toggle("on", G.toggleMap());
      }
      lastMode = mode;
    }
    requestAnimationFrame(sync);
  })();
})();
