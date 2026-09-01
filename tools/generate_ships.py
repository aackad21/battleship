"""Generates the top-down ship SVGs in assets/img.

Ships are drawn bow-right on a horizontal strip of `size` 100x100 cells; the UI
rotates them for vertical placement. Run: python3 tools/generate_ships.py
"""
import os

CELL = 100
HULL_HEIGHT = 62
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img')

DEFS = """  <defs>
    <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5b6b7d"/>
      <stop offset="45%" stop-color="#3b4757"/>
      <stop offset="100%" stop-color="#232c38"/>
    </linearGradient>
    <linearGradient id="deck" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8492a3"/>
      <stop offset="100%" stop-color="#5a6779"/>
    </linearGradient>
    <linearGradient id="tower" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#aab6c4"/>
      <stop offset="100%" stop-color="#6d7a8b"/>
    </linearGradient>
  </defs>
"""


def hull_path(width, height=HULL_HEIGHT):
    top = (CELL - height) / 2
    bottom = top + height
    bow = width - 4
    stern = 6
    shoulder = width - height * 0.85
    return (
        f"M {stern} {top + 8} "
        f"Q {stern - 4} {CELL / 2} {stern} {bottom - 8} "
        f"L {shoulder} {bottom} "
        f"Q {bow} {bottom - 6} {bow} {CELL / 2} "
        f"Q {bow} {top + 6} {shoulder} {top} "
        f"Z"
    )


def wrap(width, body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {CELL}" '
        f'width="{width}" height="{CELL}">\n{DEFS}'
        f'  <g>\n{body}  </g>\n</svg>\n'
    )


def rect(x, y, w, h, fill, rx=6, opacity=None):
    op = f' opacity="{opacity}"' if opacity else ''
    return (
        f'    <rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
        f'rx="{rx}" fill="{fill}"{op}/>\n'
    )


def circle(cx, cy, r, fill):
    return f'    <circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}"/>\n'


def base(width):
    return (
        f'    <path d="{hull_path(width)}" fill="url(#hull)"/>\n'
        f'    <path d="{hull_path(width, HULL_HEIGHT - 16)}" fill="url(#deck)" opacity="0.55"/>\n'
    )


def carrier():
    width = CELL * 5
    body = f'    <path d="{hull_path(width)}" fill="url(#hull)"/>\n'
    body += rect(24, 22, width - 60, CELL - 44, 'url(#deck)', rx=22)
    body += rect(40, CELL / 2 - 2.5, width - 130, 5, '#e8eef5', rx=2, opacity='0.8')
    body += rect(width - 150, 16, 34, 22, 'url(#tower)', rx=6)
    body += rect(width - 142, 8, 10, 12, '#c8d3df', rx=3)
    body += circle(width - 78, CELL / 2, 7, '#7b8899')
    return wrap(width, body)


def battleship():
    width = CELL * 4
    body = base(width)
    body += rect(width * 0.42, 26, 62, CELL - 52, 'url(#tower)', rx=10)
    body += rect(width * 0.46, 12, 20, 18, '#c8d3df', rx=5)
    for cx in (width * 0.24, width * 0.72):
        body += circle(cx, CELL / 2, 15, '#6f7d8e')
        body += rect(cx - 3, CELL / 2 - 30, 6, 30, '#94a2b2', rx=3)
    return wrap(width, body)


def cruiser():
    width = CELL * 3
    body = base(width)
    body += rect(width * 0.36, 28, 58, CELL - 56, 'url(#tower)', rx=10)
    body += rect(width * 0.42, 16, 16, 16, '#c8d3df', rx=4)
    body += circle(width * 0.2, CELL / 2, 12, '#6f7d8e')
    body += rect(width * 0.76, CELL / 2 - 12, 26, 24, '#6f7d8e', rx=6)
    return wrap(width, body)


def submarine():
    width = CELL * 3
    height = 46
    top = (CELL - height) / 2
    body = (
        f'    <rect x="8" y="{top}" width="{width - 20}" height="{height}" '
        f'rx="{height / 2}" fill="url(#hull)"/>\n'
    )
    body += (
        f'    <rect x="20" y="{top + 8}" width="{width - 46}" height="{height - 22}" '
        f'rx="{(height - 22) / 2}" fill="url(#deck)" opacity="0.5"/>\n'
    )
    body += rect(width * 0.42, CELL / 2 - 22, 46, 44, 'url(#tower)', rx=12)
    body += rect(width * 0.5, CELL / 2 - 34, 8, 14, '#c8d3df', rx=3)
    return wrap(width, body)


def destroyer():
    width = CELL * 2
    body = base(width)
    body += rect(width * 0.34, 30, 46, CELL - 60, 'url(#tower)', rx=9)
    body += rect(width * 0.4, 20, 14, 14, '#c8d3df', rx=4)
    body += circle(width * 0.16, CELL / 2, 10, '#6f7d8e')
    return wrap(width, body)


SHIPS = {
    'carrier': carrier,
    'battleship': battleship,
    'cruiser': cruiser,
    'submarine': submarine,
    'destroyer': destroyer,
}

if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, builder in SHIPS.items():
        path = os.path.join(OUT_DIR, f'{name}.svg')
        with open(path, 'w', encoding='utf-8') as handle:
            handle.write(builder())
        print('wrote', os.path.relpath(path))
