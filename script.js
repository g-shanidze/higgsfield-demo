/*
 * Native-playback scroll experience.
 * A downward scroll intent plays the film start -> end in one smooth motion
 * (decoded at native fps, so no seek stutter). An upward intent rewinds it.
 * Overlays are synced to playback time, not scroll position.
 */

const stage = document.querySelector(".stage");
const video = document.getElementById("hero-video");
const logo = document.getElementById("logo-overlay");
const endOverlay = document.getElementById("end-overlay");
const hotspot = document.getElementById("hotspot");
const roomCard = document.getElementById("room-card");
const roomClose = document.getElementById("room-close");
const progressFill = document.getElementById("progress-fill");

stage.classList.add("loading");

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const range = (x, inMin, inMax) => clamp((x - inMin) / (inMax - inMin), 0, 1);

let duration = 5;
let reverseRAF = null;
const PLAY_RATE = 2; // playback / rewind speed multiplier
video.playbackRate = PLAY_RATE;

video.addEventListener("loadedmetadata", () => {
  duration = video.duration || 5;
  stage.classList.remove("loading");
});
if (video.readyState >= 1) {
  duration = video.duration || 5;
  stage.classList.remove("loading");
}

/* ---- Overlay sync (runs every frame; cheap style writes) ---- */
function syncOverlays() {
  const p = duration ? clamp(video.currentTime / duration, 0, 1) : 0;

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
// Belt-and-suspenders: also sync on the video's own events so overlays stay
// correct even if rAF is throttled (e.g. background/inactive tab).
["timeupdate", "seeked", "play", "pause", "ended"].forEach((ev) =>
  video.addEventListener(ev, syncOverlays)
);
syncOverlays();

/* ---- Playback control ---- */
function stopReverse() {
  if (reverseRAF) cancelAnimationFrame(reverseRAF);
  reverseRAF = null;
}

function playForward() {
  stopReverse();
  if (video.currentTime >= duration - 0.03) return; // already at the end
  video.playbackRate = PLAY_RATE;
  video.play().catch(() => {});
}

function playReverse() {
  if (reverseRAF) return;            // already rewinding
  if (video.currentTime <= 0.03) return;
  video.pause();
  let last = performance.now();
  const step = (now) => {
    const dt = (now - last) / 1000;
    last = now;
    const t = video.currentTime - dt * PLAY_RATE; // rewind at matched speed
    if (t <= 0) {
      video.currentTime = 0;
      reverseRAF = null;
      return;
    }
    video.currentTime = t;
    reverseRAF = requestAnimationFrame(step);
  };
  reverseRAF = requestAnimationFrame(step);
}

function onIntent(dir) {
  if (dir > 0) playForward();
  else if (dir < 0) playReverse();
}

/* If a forward intent arrives mid-rewind, hand back to native play */
video.addEventListener("play", stopReverse);

/* ---- Input capture (scroll is locked; we interpret intent) ---- */
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
window.addEventListener(
  "touchstart",
  (e) => { touchY = e.touches[0].clientY; },
  { passive: true }
);
window.addEventListener(
  "touchmove",
  (e) => {
    if (touchY === null) return;
    const dy = touchY - e.touches[0].clientY; // swipe up => positive => forward
    if (Math.abs(dy) > 6) {
      onIntent(Math.sign(dy));
      touchY = e.touches[0].clientY;
    }
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
