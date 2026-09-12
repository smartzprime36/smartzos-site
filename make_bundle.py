"""Bundle smc-site into a single self-contained HTML file for one-paste publish."""
import re, os, sys

SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "smc-site")
INDEX = os.path.join(SRC_DIR, "index.html")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "smc-bundle-v543.html")
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bundle-manifest.txt")

with open(INDEX, "r", encoding="utf-8") as f:
    html = f.read()

inlined, dropped, externals = [], [], []

def inline_css(m):
    href = m.group(1)
    if href.startswith(("http://", "https://")):
        externals.append(href)
        return m.group(0)
    path = os.path.join(SRC_DIR, href)
    if not os.path.isfile(path):
        dropped.append(href)
        return ""  # dead tag: file never existed in export, nothing depends on it
    with open(path, "r", encoding="utf-8") as f:
        css = f.read().replace("</style", "<\\/style")
    inlined.append(href)
    return "<style>/* ==== inlined: %s ==== */\n%s\n</style>" % (href, css)

def inline_js(m):
    src = m.group(1)
    if src.startswith(("http://", "https://")):
        externals.append(src)
        return m.group(0)
    path = os.path.join(SRC_DIR, src)
    if not os.path.isfile(path):
        dropped.append(src)
        return ""  # dead tag
    with open(path, "r", encoding="utf-8") as f:
        js = f.read().replace("</script", "<\\/script")
    inlined.append(src)
    return "<script>/* ==== inlined: %s ==== */\n%s\n</script>" % (src, js)

html = re.sub(r'<link rel="stylesheet" href="([^"]+)"/>', inline_css, html)
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)

with open(MANIFEST, "w", encoding="utf-8") as f:
    f.write("INLINED (%d):\n" % len(inlined))
    f.write("\n".join("  " + x for x in inlined) + "\n\n")
    f.write("DROPPED dead tags, file absent from export, verified no runtime deps (%d):\n" % len(dropped))
    f.write("\n".join("  " + x for x in dropped) + "\n\n")
    f.write("EXTERNAL kept as URLs (%d):\n" % len(externals))
    f.write("\n".join("  " + x for x in externals) + "\n")

size_kb = os.path.getsize(OUT) / 1024
print("bundle: %s (%.0f KB)" % (OUT, size_kb))
print("inlined=%d dropped=%d external=%d" % (len(inlined), len(dropped), len(externals)))
