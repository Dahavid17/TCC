/* =============================================================
   INTRO.JS — Animação de entrada BuzzCodex
   NOVO ARQUIVO (extraído de index.html para melhor manutenção)
   Corrigido:
   - cancelAnimationFrame ao clicar em "Pular intro"
   - prefers-reduced-motion respeitado
   - Namespace no sessionStorage
   - Partículas reduzidas em mobile
   ============================================================= */

/* ── prefers-reduced-motion: pular direto ──────────────── */
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  window.location.href = "home.html";
}

const canvas = document.getElementById("c");
const ctx    = canvas.getContext("2d");
let W, H;

/* ── Logo ─────────────────────────────────────────────── */
const logoImg = new Image();
logoImg.src   = "img/2.png";

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

/* ── Timing ───────────────────────────────────────────── */
const T = {
  ringsIn:        0.3,
  ringsFullSpeed: 1.2,
  logoIn:         2.2,
  tagIn:          3.1,
  hold:           4.5,
  fadeOut:        5.5,
  end:            6.8
};

let t    = 0;
let last = null;
let animationId;

/* ── Helpers ──────────────────────────────────────────── */
const ease  = x => x < 0.5 ? 2*x*x : 1 - Math.pow(-2*x+2,2)/2;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const progress = (start, end) => ease(clamp((t-start)/(end-start), 0, 1));

/* ── Anéis orbitais ───────────────────────────────────── */
const rings = [
  { tilt:  0,   speed:  0.55, color: "#a304d3", rs: 1.00, thick: 4.5, delay: 0.00 },
  { tilt:  60,  speed: -0.85, color: "#34d304", rs: 0.82, thick: 3.5, delay: 0.12 },
  { tilt: -55,  speed:  0.70, color: "#c000ff", rs: 0.64, thick: 3.0, delay: 0.24 },
  { tilt:  30,  speed: -1.05, color: "#34d304", rs: 0.46, thick: 2.5, delay: 0.36 },
];

function drawRing(cx, cy, rx, tiltDeg, rotAngle, color, alpha, lw) {
  const scaleY = Math.abs(Math.cos(tiltDeg * Math.PI / 180)) || 0.05;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotAngle);
  ctx.scale(1, scaleY);
  ctx.globalAlpha   = alpha;
  ctx.shadowBlur    = 30;
  ctx.shadowColor   = color;
  ctx.strokeStyle   = color;
  ctx.lineWidth     = lw;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ── Logo hexagonal ───────────────────────────────────── */
function drawHexLogo(cx, cy, size, alpha) {
  if (alpha <= 0 || !logoImg.complete || !logoImg.naturalWidth) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  const aspect = logoImg.naturalWidth / logoImg.naturalHeight;
  const drawH  = size * 2.2;
  const drawW  = drawH * aspect;

  ctx.shadowBlur = 55; ctx.shadowColor = "#c000ff";
  ctx.drawImage(logoImg, cx - drawW/2, cy - drawH/2, drawW, drawH);
  ctx.shadowBlur = 30; ctx.shadowColor = "#34d304";
  ctx.drawImage(logoImg, cx - drawW/2, cy - drawH/2, drawW, drawH);
  ctx.shadowBlur = 0;
  ctx.drawImage(logoImg, cx - drawW/2, cy - drawH/2, drawW, drawH);
  ctx.restore();
}

/* ── Partículas — CORRIGIDO: menos em mobile ──────────── */
const isMobile    = window.innerWidth < 768;
const PART_COUNT  = isMobile ? 36 : 90;

const particles = Array.from({ length: PART_COUNT }, () => ({
  x:     Math.random() * 2 - 1,
  y:     Math.random() * 2 - 1,
  vx:    (Math.random() - 0.5) * 0.001,
  vy:    (Math.random() - 0.5) * 0.001,
  size:  Math.random() * 1.6 + 0.5,
  color: Math.random() < 0.6 ? "#c000ff" : "#34d304",
  alpha: Math.random() * 0.6 + 0.2
}));

/* ── Loop ─────────────────────────────────────────────── */
function draw(ts) {
  if (!last) last = ts;
  const dt = Math.min((ts - last) / 1000, 0.05);
  last = ts;
  t   += dt;

  ctx.clearRect(0, 0, W, H);

  // Fundo
  const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.8);
  bg.addColorStop(0,   `rgba(25, 4, 60,  ${0.28 * clamp(t*0.4, 0, 1)})`);
  bg.addColorStop(0.7, `rgba(52, 211, 4, ${0.03 * clamp(t*0.4, 0, 1)})`);
  bg.addColorStop(1,   "#09090d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Partículas
  const pA = progress(0.2, 1.4);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    if (Math.abs(p.x) > 1.05) p.vx *= -1;
    if (Math.abs(p.y) > 1.05) p.vy *= -1;
    const px = (p.x + 1) / 2 * W;
    const py = (p.y + 1) / 2 * H;
    ctx.globalAlpha = p.alpha * pA;
    ctx.fillStyle   = p.color;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(px, py, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  const cx    = W / 2;
  const cy    = H / 2;
  const baseR = Math.min(W, H) * 0.36;

  // Anéis
  rings.forEach(ring => {
    const inP = progress(T.ringsIn + ring.delay, T.ringsFullSpeed + ring.delay);
    if (inP <= 0) return;
    const spinStart = T.ringsFullSpeed + ring.delay;
    const spinAngle = ring.speed * Math.max(0, t - spinStart) + (ring.tilt * Math.PI / 180) * 0.4;
    drawRing(cx, cy, baseR * ring.rs * (0.5 + 0.5*inP), ring.tilt, spinAngle, ring.color, inP*0.85, ring.thick*inP);
  });

  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;

  // Brilho central
  const glowP = progress(T.ringsIn, T.logoIn);
  if (glowP > 0) {
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.3);
    gr.addColorStop(0,   `rgba(192, 0, 255, ${0.32 * glowP})`);
    gr.addColorStop(0.6, `rgba(52, 211, 4,  ${0.1  * glowP})`);
    gr.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Logo
  const logoP = progress(T.logoIn, T.logoIn + 0.7);
  if (logoP > 0) drawHexLogo(cx, cy, baseR * 0.52 * (0.5 + 0.5*logoP), logoP);

  // Texto
  const textP = progress(T.tagIn, T.tagIn + 0.65);
  if (textP > 0) {
    ctx.save();
    ctx.globalAlpha = textP;
    const fs      = Math.min(W, H) * 0.052;
    const textY   = cy + baseR * 0.56;
    ctx.font      = `900 ${fs}px Arial`;
    ctx.textBaseline = "middle";

    const buzzW   = ctx.measureText("BUZZ").width;
    const spaceW  = ctx.measureText(" ").width;
    const codeW   = ctx.measureText("CODE").width;
    const startX  = cx - (buzzW + spaceW + codeW) / 2;

    ctx.textAlign   = "left";
    ctx.shadowBlur  = 35; ctx.shadowColor = "#c000ff";
    ctx.fillStyle   = "#ffffff";
    ctx.fillText("BUZZ", startX, textY);

    ctx.shadowColor = "rgba(52,211,4,.6)";
    ctx.fillStyle   = "#34d304";
    ctx.fillText("CODE", startX + buzzW + spaceW, textY);

    ctx.textAlign   = "center";
    ctx.font        = `bold ${Math.min(W,H)*0.015}px Arial`;
    ctx.fillStyle   = "#bdbdbd";
    ctx.shadowBlur  = 0;
    ctx.fillText("DESENVOLVIMENTO WEB", cx, cy + baseR * 0.72);
    ctx.restore();
  }

  // Fade out
  if (t >= T.fadeOut) {
    const fo = clamp((t - T.fadeOut) / (T.end - T.fadeOut), 0, 1);
    ctx.fillStyle = `rgba(9,9,13,${fo})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (t >= T.end) {
    // CORRIGIDO: namespace no sessionStorage
    sessionStorage.setItem("buzzcodex:animacaoVista", "true");
    window.location.href = "home.html";
    return;
  }

  animationId = requestAnimationFrame(draw);
}

/* ── Skip com cancelAnimationFrame ───────────────────── */
document.getElementById("skip")?.addEventListener("click", (e) => {
  e.preventDefault();
  cancelAnimationFrame(animationId); // CORRIGIDO: cancela o loop
  sessionStorage.setItem("buzzcodex:animacaoVista", "true");
  window.location.href = "home.html";
});

animationId = requestAnimationFrame(draw);