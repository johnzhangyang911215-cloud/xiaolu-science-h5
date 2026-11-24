#!/usr/bin/env python3
"""Subset Source Han Serif / Sans to exactly the glyphs film/copy.json needs (plus digits and basic punctuation).
Usage: python3 tools/subset_fonts.py SourceHanSerifCN-Regular.otf SourceHanSansCN-Regular.otf
Source OTFs: https://github.com/adobe-fonts/source-han-serif / source-han-sans (release/SubsetOTF/CN), OFL-1.1.
Writes film/assets/fonts/film-serif.woff2 and film-sans.woff2. Re-run whenever copy.json gains new characters."""
import json, os, sys
from fontTools import subset

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'film')
copy = json.load(open(os.path.join(root, 'copy.json'), encoding='utf-8'))
chars = set(''.join(e['text'] for e in copy['entries']))
chars |= set('0123456789 .,:;!?-–—+%°·()（），。、：；！？“”‘’《》℃−×/↑↓*|')
text = ''.join(sorted(chars))
for src, name in zip(sys.argv[1:3], ['film-serif', 'film-sans']):
    out = os.path.join(root, 'assets', 'fonts', name + '.woff2')
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    font = subset.load_font(src, opts)
    s = subset.Subsetter(opts); s.populate(text=text); s.subset(font)
    subset.save_font(font, out, opts)
    print(out, os.path.getsize(out), 'bytes,', len(text), 'chars')
