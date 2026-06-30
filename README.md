# Abastumani Residence — Scroll-Driven Video Demo

A single-screen cinematic landing page. Scrolling down plays an AI-generated
hotel film (Higgsfield, 2K) start→end in one smooth motion; scrolling up rewinds it.
Overlays (logo, closing CTA, an interactive room hotspot) are synced to playback.

Pure static site — no build step.

- `index.html` · `styles.css` · `script.js`
- `assets/hotel.mp4` (2K) · `assets/logo.png`

## Run locally
Any static server with HTTP range support, e.g.:
```
npx serve -l 5050 .
```
Then open http://localhost:5050
