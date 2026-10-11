#!/usr/bin/env python3
"""
Turns the world pictures exported from the design project into what the menus load.

    python3 scripts/world-art.py <folder of 16:10 PNGs>

Each PNG is named after its world (`ice.png`); a finale goes by the name it has in the
design project. Two WebP files come out per world, named by world id, in
`src/assets/worlds/`: `card/` for the world cards and the blurred backdrop, `full/` for
the world's own page. Needs Pillow (`pip install pillow`).
"""
import sys
from pathlib import Path

from PIL import Image

# Finales are worlds too, but the design project names them after the hole.
FINALES = {
    'gauntlet': 'ch1-finale',
    'countdown': 'ch2-finale',
    'grand': 'ch3-finale',
    'temple': 'ch4-finale',
    'spring': 'ch5-finale',
    'works': 'ch6-finale',
    'dayout': 'ch7-finale',
    'strange': 'ch8-finale',
    'castle': 'ch9-finale',
}
# A card is at most 280 CSS px wide and the large picture about 540: both doubled.
SIZES = {'card': (640, 400), 'full': (1280, 800)}
OUT = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'worlds'


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sources = sorted(Path(sys.argv[1]).glob('*.png'))
    if not sources:
        sys.exit(f'No PNG files in {sys.argv[1]}')
    for source in sources:
        world = FINALES.get(source.stem, source.stem)
        picture = Image.open(source).convert('RGB')
        for folder, size in SIZES.items():
            target = OUT / folder / f'{world}.webp'
            target.parent.mkdir(parents=True, exist_ok=True)
            picture.resize(size, Image.LANCZOS).save(target, 'WEBP', quality=82, method=6)
    print(f'{len(sources)} worlds written to {OUT}')


if __name__ == '__main__':
    main()
