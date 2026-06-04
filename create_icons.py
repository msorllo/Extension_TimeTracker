"""
create_icons.py — Crea los iconos PNG para la extensión Chrome.
Requiere solo la librería estándar de Python + Pillow.

Instala Pillow si no lo tienes:
  pip install Pillow

Luego ejecuta:
  python create_icons.py
"""

import os
import math

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("❌ Pillow no instalado. Ejecuta: pip install Pillow")
    exit(1)

SIZES = [16, 32, 48, 128]
ICONS_DIR = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(ICONS_DIR, exist_ok=True)

def draw_clock_icon(size: int) -> Image.Image:
    scale = size / 128
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Fondo redondeado
    radius = int(size * 0.18)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=(13, 15, 26, 255))

    # Círculo exterior del reloj (color acento #6c63ff)
    cx, cy = size / 2, size / 2
    ring_r = size * 0.35
    ring_w = max(2, int(size * 0.07))
    draw.ellipse(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        outline=(108, 99, 255, 255),
        width=ring_w,
    )

    # Manecilla larga (hacia arriba)
    hand_w = max(1, int(size * 0.06))
    draw.line([(cx, cy), (cx, cy - size * 0.27)], fill=(255, 255, 255, 255), width=hand_w)

    # Manecilla corta (hacia la derecha-abajo, ~4:00)
    angle = math.radians(120)  # 4 en punto
    end_x = cx + math.sin(angle) * size * 0.20
    end_y = cy - math.cos(angle) * size * 0.20
    draw.line([(cx, cy), (end_x, end_y)], fill=(157, 151, 255, 255), width=max(1, int(size * 0.055)))

    # Punto central
    dot_r = size * 0.06
    draw.ellipse(
        [cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
        fill=(108, 99, 255, 255),
    )

    return img

for size in SIZES:
    icon = draw_clock_icon(size)
    output_path = os.path.join(ICONS_DIR, f"icon{size}.png")
    icon.save(output_path, "PNG")
    print(f"✅ icon{size}.png → {output_path}")

print("\n🎉 ¡Iconos generados correctamente en la carpeta icons/!")
