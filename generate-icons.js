// ─────────────────────────────────────────────
// generate-icons.js — Script de Node.js (ejecutar una vez)
// Genera los iconos PNG en múltiples tamaños usando Canvas.
// Ejecutar con: node generate-icons.js
// ─────────────────────────────────────────────

// NOTA: Si no tienes Node.js o prefieres no ejecutar este script,
// puedes usar cualquier imagen PNG 128x128 y nombrarla icon128.png,
// luego escalarla a 48, 32 y 16 px con cualquier editor.

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 32, 48, 128];
const ICONS_DIR = path.join(__dirname, 'icons');

if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR);

SIZES.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fondo degradado
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#1e2238');
  bg.addColorStop(1, '#0d0f1a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.18);
  ctx.fill();

  // Círculo exterior del reloj
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.35, 0, Math.PI * 2);
  ctx.strokeStyle = '#6c63ff';
  ctx.lineWidth = size * 0.07;
  ctx.stroke();

  // Manecilla larga (12 → 3)
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.5);
  ctx.lineTo(size * 0.5, size * 0.22);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = size * 0.06;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Manecilla corta (12 → 4)
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.5);
  ctx.lineTo(size * 0.68, size * 0.58);
  ctx.strokeStyle = '#9d97ff';
  ctx.lineWidth = size * 0.055;
  ctx.stroke();

  // Centro
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = '#6c63ff';
  ctx.fill();

  fs.writeFileSync(path.join(ICONS_DIR, `icon${size}.png`), canvas.toBuffer('image/png'));
  console.log(`✅ icon${size}.png generado`);
});
