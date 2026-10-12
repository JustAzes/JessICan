# JessICan entwickeln

Die Website verwendet Zola 0.23.6 und eine auf die tatsächlich verwendeten Regeln
reduzierte Bootstrap-5.3.8-CSS-Datei. JavaScript und Schriften werden lokal
ausgeliefert. Es sind keine npm-Abhängigkeiten oder Zugangsdaten für den lokalen
Build erforderlich.

## Installation und Start

Benötigt werden Bash, curl, tar, ein SHA-256-Werkzeug und Python 3.11 oder neuer.
Die Zola-Version steht in `.zola-version`. Der Installer prüft den Download gegen
die offiziellen SHA-256-Digests in `tools/zola-checksums.txt` und kontrolliert die
Version des entpackten Programms.

```bash
bash tools/install-zola.sh
.tools/bin/zola build --output-dir .tools/site --force
python3 tools/check-site.py .tools/site
.tools/bin/zola serve --interface 127.0.0.1 --port 1111 --output-dir .tools/dev --force
```

Die Ausgabe liegt unter `.tools/`, weil das bisherige `public/` versionierte
Font-Dateien enthält. Zola leert das gewählte Ausgabeverzeichnis beim Build.
CI und der Netlify-Helfer prüfen die Ausgabeziele davor. Der Netlify-Helfer
erlaubt innerhalb des Checkouts nur `.tools/site`; externe bestehende Ordner
müssen als eigene generierte Ausgabe gekennzeichnet sein. Die Kennzeichnung
liegt außerhalb der veröffentlichten Dateien.
Der Entwicklungsserver muss in jeder neuen Cloud-Aufgabe neu gestartet werden.
Cloud-Aufgaben sind bereits isoliert; den vorhandenen Checkout verwenden und
nur auf ausdrücklichen Wunsch einen Git-Worktree anlegen.

## Deployment

GitHub baut Pull Requests und Änderungen auf `main` mit derselben geprüften
Zola-Version. Der Build prüft die wichtigsten Seiten, Navigation, Assets,
Quiz-Daten, Sitemap und `CNAME`. Nur ein erfolgreicher `main`-Build oder ein
manuell gestarteter `main`-Lauf veröffentlicht das geprüfte Artefakt nach
`gh-pages`. Die vorhandene GitHub-Pages-Einstellung für diesen Branch bleibt
verwendbar. Der Build hat Leserechte; nur der Deployment-Job hat Schreibrechte.
Externe Actions sind auf Commit-SHAs festgelegt und werden durch Dependabot
regelmäßig auf Updates geprüft.

Nach der Veröffentlichung prüft ein weiterer Actions-Job die echte
Produktionsdomain über HTTPS. Er wartet auf die erwartete Ausgabe, vergleicht
alle öffentlichen Dateien mit dem Build-Artefakt und prüft Navigation,
Formularvalidierung und beide Quizze im Browser. Das Kontaktformular wird dabei
nicht abgeschickt. JSON-Ergebnisse und Logs stehen als `live-verification`-
Artefakt bereit, auch wenn eine Prüfung fehlschlägt.

Netlify verwendet `bash tools/build-netlify.sh` und veröffentlicht `.tools/site`.
Bei `CONTEXT=deploy-preview` verwendet das Skript `DEPLOY_PRIME_URL` als
Basis-URL. Der Installer, die Version und die Prüfungen sind identisch mit dem
lokalen und dem GitHub-Build.

Ein Versionsupdate von Zola benötigt eine gemeinsame Änderung an
`.zola-version` und den offiziellen Prüfsummen. Ein fehlender oder abweichender
Digest bricht die Installation ab. Anschließend Build und Prüfungen ausführen;
Konfiguration, Template-Syntax und alle bisherigen URLs müssen erhalten bleiben.

## CSS aktualisieren

`static/css/bootstrap.min.css` und die zugehörige Source Map stammen aus dem
offiziellen Bootstrap-5.3.8-Paket. `tools/bootstrap-subset.py` erzeugt daraus die
benötigte Teilmenge. Das Bibliotheks-Lizenzbanner bleibt in der generierten Datei
und im ausgelieferten Stylesheet erhalten.

```bash
.tools/bin/zola build --output-dir .tools/site --force
bash tools/build-css.sh .tools/site
.tools/bin/zola build --output-dir .tools/site --force
python3 tools/check-site.py .tools/site
```

Die Generierung aktualisiert `sass/_bootstrap-subset.scss`. Die bestehenden
Theme-Einstellungen und die Kompatibilität für bisherige Klassen, Abstände und
Breakpoints liegen separat in `sass/_bootstrap-compat.scss`. Dadurch kann die
Bootstrap-Version aktualisiert werden, ohne das gewünschte Aussehen an die
Standarddarstellung der neuen Version anzupassen.

## Migration und Browser prüfen

Der Vergleich zweier Produktionsbuilds kontrolliert alle Ausgabepfade, sichtbaren
Texte, Seitentitel, Links und Formularziele:

```bash
python3 tools/verify-migration.py /pfad/zum/bisherigen-build .tools/site
```

Für optionale Browserprüfungen werden Playwright, Pillow und Chromium benötigt.
Die vorbereitete Cloud-Umgebung enthält diese Werkzeuge bereits. Der Standardmodus
lädt die angegebenen lokalen Build-Dateien. Die separat aufgeführten Live-Prüfungen
laden echte Produktionsantworten über HTTPS. Kontaktformulare werden in beiden
Modi nicht abgeschickt.

```bash
python3 tools/check-browser.py .tools/site
python3 tools/check-live-site.py --build .tools/site --all-files
python3 tools/check-browser.py .tools/site --live --chromium /usr/bin/chromium
python3 tools/verify-migration.py /pfad/zum/bisherigen-build .tools/site \
  --screenshots /tmp/jessican-layout-vergleich
```

`check-browser.py` prüft Navigation, Formularverhalten und beide Quiz-Auswertungen.
Mit `--live` verwendet es echte Produktionsantworten. Die Live-Prüfungen benötigen
Netzzugang zur Produktionsdomain; GitHub Actions führt sie nach jedem erfolgreichen
`main`-Deployment automatisch aus.
Der Screenshot-Vergleich prüft Mobil-, Tablet- und Desktopbreite. Ein bloßer
Build-Erfolg ersetzt diese Prüfung beim Wechsel der Zola- oder Bootstrap-Version
nicht.

## Lighthouse und Cookie-Freiheit prüfen

Nach einem vollständig erfolgreichen Deployment führt `Lighthouse production
audit` echte mobile und Desktop-Messungen der Produktionsdomain aus. Lighthouse,
Chrome-Launcher und Playwright sind ausschließlich Prüfwerkzeuge unter
`tools/performance`; sie werden weder für den Website-Build benötigt noch an
Besucher ausgeliefert. Die Versionen und Paket-Digests sind im npm-Lockfile
festgelegt und werden durch Dependabot geprüft.

Der zusätzliche direkte Browserlauf prüft Cookies, Speicher und automatisch
geladene externe Ressourcen, ohne das Kontaktformular abzusenden. Browser-Caching
funktioniert unabhängig von Cookies. GitHub Pages bestimmt die HTTP-Cache-Header;
bestehende Indexierungsregeln können den Lighthouse-SEO-Wert bewusst begrenzen.

Vollständige HTML-/JSON-Berichte liegen 30 Tage im Actions-Artefakt
`lighthouse-reports`. Die kompakten Zusammenfassungen bleiben auf dem separaten
Branch `performance-reports` unter `runs/<Actions-Lauf-ID>/` erhalten. Dieser
Branch hat keinen Einfluss auf die veröffentlichte Seite.

Für einen eigenen Lauf sind Node.js ab 22.19 und Chrome/Chromium erforderlich:

```bash
npm ci --prefix tools/performance --ignore-scripts --no-audit --no-fund
CHROME_PATH=/usr/bin/chromium node tools/performance/run-lighthouse.mjs \
  --output .tools/lighthouse --runs 1
```

Diese Messung braucht direkten Netzzugang zur Produktionsdomain. Für lokale
Funktionsprüfungen kann `--base-url http://127.0.0.1:1111` angegeben werden;
lokale Ergebnisse sind keine Live-PageSpeed-Messungen. Mehrere Wiederholungen
lassen sich mit `--runs 3` ausführen, einzelne Seiten mit `--routes /,/contact/`.
