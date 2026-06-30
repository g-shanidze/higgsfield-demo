/*
 * Native-playback scroll experience.
 * Scrolling down plays the forward clip; scrolling up plays a pre-reversed clip
 * forward. Both directions are real native playback (decoded forward), so neither
 * stutters the way backward seeking does. Overlays sync to whichever clip is active.
 */

const stage = document.querySelector(".stage");
const fwd = document.getElementById("hero-video");
const rev = document.getElementById("hero-video-rev");
const logo = document.getElementById("logo-overlay");
const endOverlay = document.getElementById("end-overlay");
const hotspot = document.getElementById("hotspot");
const roomCard = document.getElementById("room-card");
const roomClose = document.getElementById("room-close");
const progressFill = document.getElementById("progress-fill");

stage.classList.add("loading");

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const range = (x, inMin, inMax) => clamp((x - inMin) / (inMax - inMin), 0, 1);

const RATE = 2; // playback speed multiplier
let duration = 5;
let active = "fwd"; // which clip is currently shown

[fwd, rev].forEach((v) => (v.playbackRate = RATE));

fwd.addEventListener("loadedmetadata", () => {
  duration = fwd.duration || 5;
  stage.classList.remove("loading");
});
if (fwd.readyState >= 1) {
  duration = fwd.duration || 5;
  stage.classList.remove("loading");
}

/* ---- Progress + overlay sync ---- */
// Normalised journey position 0 (launch) -> 1 (end), regardless of active clip.
function progress() {
  if (active === "rev") return clamp(1 - rev.currentTime / duration, 0, 1);
  return clamp(fwd.currentTime / duration, 0, 1);
}

function syncOverlays() {
  const p = progress();
  progressFill.style.transform = `scaleX(${p})`;
  logo.style.opacity = 1 - range(p, 0.0, 0.12);
  endOverlay.style.opacity = range(p, 0.78, 0.96);
  endOverlay.style.pointerEvents = p >= 0.9 ? "auto" : "none";

  const showHotspot = p >= 0.82;
  hotspot.style.opacity = range(p, 0.82, 0.92);
  hotspot.style.pointerEvents = showHotspot ? "auto" : "none";
  if (!showHotspot && roomCard.classList.contains("open")) closeCard();
}
(function loop() {
  syncOverlays();
  requestAnimationFrame(loop);
})();
["timeupdate", "seeked", "play", "pause", "ended"].forEach((ev) => {
  fwd.addEventListener(ev, syncOverlays);
  rev.addEventListener(ev, syncOverlays);
});
syncOverlays();

/* ---- Direction control ---- */
function setActive(which) {
  active = which;
  fwd.classList.toggle("is-active", which === "fwd");
  rev.classList.toggle("is-active", which === "rev");
}

// Seek a video to t, then run cb once the frame is ready (with a timeout guard
// so a swap never visibly shows an undecoded frame).
function seekThen(v, t, cb) {
  if (Math.abs(v.currentTime - t) < 0.02) { cb(); return; }
  let done = false;
  const fire = () => { if (done) return; done = true; cb(); };
  v.addEventListener("seeked", fire, { once: true });
  setTimeout(fire, 200);
  v.currentTime = t;
}

function playForward() {
  if (active === "fwd") {
    if (fwd.currentTime >= duration - 0.03) return; // already at the end
    fwd.playbackRate = RATE;
    fwd.play().catch(() => {});
    return;
  }
  // Hand off from the reverse clip: mirror the timeline and switch.
  rev.pause();
  const t = clamp(duration - rev.currentTime, 0, duration);
  seekThen(fwd, t, () => {
    setActive("fwd");
    fwd.playbackRate = RATE;
    fwd.play().catch(() => {});
  });
}

function playReverse() {
  if (active === "rev") {
    if (rev.currentTime >= duration - 0.03) return; // already back at launch
    rev.playbackRate = RATE;
    rev.play().catch(() => {});
    return;
  }
  // Hand off from the forward clip.
  fwd.pause();
  if (fwd.currentTime <= 0.03) return; // already at launch
  const t = clamp(duration - fwd.currentTime, 0, duration);
  seekThen(rev, t, () => {
    setActive("rev");
    rev.playbackRate = RATE;
    rev.play().catch(() => {});
  });
}

function onIntent(dir) {
  if (dir > 0) playForward();
  else if (dir < 0) playReverse();
}

/* ---- Input capture (native scroll locked; we interpret intent) ---- */
window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (Math.abs(e.deltaY) < 1) return;
    onIntent(Math.sign(e.deltaY));
  },
  { passive: false }
);

let touchY = null;
window.addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener(
  "touchmove",
  (e) => {
    if (touchY === null) return;
    const dy = touchY - e.touches[0].clientY; // swipe up => forward
    if (Math.abs(dy) > 6) { onIntent(Math.sign(dy)); touchY = e.touches[0].clientY; }
    e.preventDefault();
  },
  { passive: false }
);
window.addEventListener("touchend", () => { touchY = null; });

window.addEventListener("keydown", (e) => {
  if (["ArrowDown", "PageDown", " ", "Spacebar"].includes(e.key)) { e.preventDefault(); onIntent(1); }
  else if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); onIntent(-1); }
});

/* ---- Room card interactions ---- */
function openCard() { roomCard.classList.add("open"); }
function closeCard() { roomCard.classList.remove("open"); }
function toggleCard(e) { e.stopPropagation(); roomCard.classList.toggle("open"); }

hotspot.addEventListener("mouseenter", openCard);
hotspot.addEventListener("click", toggleCard);
roomClose.addEventListener("click", (e) => { e.stopPropagation(); closeCard(); });
roomCard.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", closeCard);
