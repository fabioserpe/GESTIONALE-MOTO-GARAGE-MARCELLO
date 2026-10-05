#!/bin/bash
# Collaudo automatico: esegue index.html con un finto Firebase in Chrome senza finestra.
# Uso (dalla cartella del progetto):  ./collaudo/collauda.sh        → esito + prove fallite
#                                     ./collaudo/collauda.sh -v     → tutte le prove
# Non tocca il database vero. Esce con codice 1 se una prova fallisce.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PROG="$(dirname "$DIR")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$(mktemp -d)"
trap 'pkill -f "$OUT/profilo" 2>/dev/null; rm -rf "$OUT"' EXIT

cp "$DIR/fake-firebase.js" "$DIR/dati-iniziali.js" "$DIR/scenari.js" "$OUT/"
python3 - "$PROG/index.html" "$OUT/app.html" <<'PY' || exit 2
import re, sys
h = open(sys.argv[1], encoding='utf-8').read()
tags = re.findall(r'<script src="https://www\.gstatic\.com/firebasejs/[^"]+"></script>\n?', h)
assert len(tags) == 4, f'script Firebase trovati: {len(tags)} (attesi 4)'
h = h.replace(tags[0], '<script src="fake-firebase.js"></script>\n<script src="dati-iniziali.js"></script>\n', 1)
for t in tags[1:]:
    h = h.replace(t, '', 1)
h = h.replace('</body>', '<pre id="e2e-risultati"></pre><pre id="e2e-pdf" style="display:none"></pre>\n<script src="scenari.js"></script>\n</body>', 1)
open(sys.argv[2], 'w', encoding='utf-8').write(h)
PY

# Chrome scrive la pagina finale ma poi non si chiude: lo fermiamo appena il file è completo (max 150 s)
perl -e '
  my ($limite, $file, @cmd) = @ARGV;
  my $pid = fork;
  if (!$pid) { open STDERR, ">", "/dev/null"; exec @cmd; exit 1 }
  for (1 .. $limite) {
    sleep 1;
    if (open my $f, "<", $file) { local $/; my $c = <$f>; if (defined $c && $c =~ m{</html>}i) { sleep 1; last } }
  }
  kill 9, $pid; waitpid $pid, 0; exit 0
' 150 "$OUT/dom.html" "$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --disable-extensions --disable-component-update --use-mock-keychain --user-data-dir="$OUT/profilo" \
  --window-size=1512,900 --virtual-time-budget=150000 --dump-dom "file://$OUT/app.html" > "$OUT/dom.html"

python3 - "$OUT/dom.html" "${1:-}" <<'PY'
import re, sys, html
dom = open(sys.argv[1], encoding='utf-8', errors='replace').read()
m = re.search(r'<pre id="e2e-risultati">(.*?)</pre>', dom, re.S)
testo = html.unescape(m.group(1)).strip() if m else ''
if not testo:
    print('NESSUN RISULTATO: gli scenari non sono arrivati in fondo (errore di caricamento o di sintassi?)')
    sys.exit(1)
righe = testo.split('\n')
print('\n'.join(righe if sys.argv[2] == '-v' else [r for r in righe if not r.startswith('OK ')]))
sys.exit(1 if 'FALLITE' in righe[0] else 0)
PY
