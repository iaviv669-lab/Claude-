"""Turn dist-single/index.html into ../deploy/setkeeper.html (page content only; the artifact host adds the document skeleton)."""
import re, pathlib
s = pathlib.Path('dist-single/index.html').read_text(encoding='utf-8')
head = s[s.index('<head>') + 6:s.index('</head>')]
script = re.search(r'<script type="module" crossorigin>(.*?)</script>', head, re.S).group(1)
style = re.search(r'<style rel="stylesheet" crossorigin>(.*?)</style>', head, re.S).group(1)
assert '</script' not in script.lower() and '</style' not in style.lower()
out = pathlib.Path('../deploy/ironrow.html')
out.parent.mkdir(exist_ok=True)
out.write_text(f'<title>Ironrow</title>\n<style>{style}\nbody{{font-size:16px}}\n</style>\n<div id="root"></div>\n<script type="module">{script}</script>\n', encoding='utf-8')
print('wrote', out, out.stat().st_size, 'bytes')
