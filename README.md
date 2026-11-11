# Eriks Rezepte

Rezepte mit Makros, Wochenplanung mit Diensten, Vorratskiste und Einkaufsliste als Web-App fürs iPhone.
Die App läuft komplett im Browser. Sie hat keinen Server, kein Konto und kein Tracking und lädt keine externen Schriften.
Deine Daten liegen nur auf deinem Gerät.

## Aufbau

| Ordner/Datei | Inhalt |
|---|---|
| `quelle/eriks-rezepte.html` | Die ganze App in einer Datei. Läuft auch direkt per Doppelklick auf dem Mac. |
| `build.py` | Baut daraus die iPhone-Fassung in `docs/`. |
| `docs/` | Die Dateien, die GitHub Pages ausliefert (App, Offline-Speicher, App-Icon). |

## Auf GitHub veröffentlichen (einmalig)

1. Lege auf github.com ein neues Repository an, z. B. `rezepte`. Mit einem kostenlosen Konto muss es **öffentlich** sein, damit GitHub Pages funktioniert. Der Code enthält keine persönlichen Daten.
2. Lade den Inhalt dieses Ordners hoch: im Terminal mit `git push` oder im Browser per „Add file → Upload files“.
3. Öffne im Repository **Settings → Pages**. Wähle unter „Build and deployment“ die Quelle **Deploy from a branch**, dann den Branch `main` und den Ordner `/docs`. Danach auf **Save** klicken.
4. Nach etwa einer Minute ist die App unter `https://<dein-name>.github.io/rezepte/` erreichbar.

## Aufs iPhone holen

1. Öffne die Adresse in **Safari**.
2. Tippe auf **Teilen → Zum Home-Bildschirm**. Ab iOS 26 öffnet sich das als Web-App.
3. Starte die App ab jetzt immer über das Icon. Der Home-Bildschirm hat einen **eigenen Speicher**, getrennt von Safari. Rezepte, die du in Safari anlegst, siehst du also nicht in der App und umgekehrt.

Nach dem ersten Start funktioniert die App auch offline.

## Updates

Ändere `quelle/eriks-rezepte.html`, führe `python3 build.py` aus und lade die Änderungen hoch.
Beim nächsten Öffnen zeigt die App „Neue Version verfügbar“ an. Ein Tipp auf **Aktualisieren** lädt die neue Version. Deine Daten bleiben dabei erhalten.

## Backup

- **Sichern:** Seitenleiste → **Backup** → **Backup sichern**. Auf dem iPhone öffnet sich das Teilen-Menü. Dort „In Dateien sichern“ wählen, dann iCloud Drive oder „Auf meinem iPhone“. Auf dem Mac wählst du den Speicherort selbst, sonst landet die Datei in „Downloads“.
- **Wiederherstellen:** **Importieren** und dann die Datei auswählen. Vorher siehst du eine Vorschau und wählst zwischen „Zusammenführen“ und „Alles ersetzen“. Ein Import lässt sich einmal rückgängig machen.
- **Einzelnes Rezept:** In der Rezeptansicht auf **Teilen** tippen. So entsteht eine kleine `.json`-Datei, die du per AirDrop, Mail oder Messenger weitergeben kannst. Der Empfänger importiert sie über **Importieren**.
- Die App erinnert dich, wenn dein letztes Backup älter als 7 Tage ist.

**Datenmengen (gemessen):** ein Rezept ohne Foto ca. 2 KB, ein Foto ca. 100–250 KB, ein Tag im Wochenplan ca. 0,4 KB.
60 Rezepte mit 40 Fotos und ein ganzes Jahr Wochenplan ergeben ca. 5 MB, ohne Fotos ca. 0,3 MB.

## Für die Gruppe (auf eigenes Risiko)

Jede Person öffnet dieselbe Adresse und legt die App auf den Home-Bildschirm. Jedes Gerät hat dabei **seine eigenen, getrennten Daten**. Niemand sieht die Rezepte oder Pläne der anderen. Rezepte teilt ihr über die Teilen-Funktion als Datei.

Hinweise:

- Die App wird ohne Gewähr bereitgestellt. Jede Person ist selbst für ihre Backups verantwortlich.
- GitHub (der Hoster) speichert beim Aufruf technische Zugriffsdaten wie die IP-Adresse. Die App selbst sendet keine Daten.
- Bei einer privaten Nutzung im Freundeskreis ist meist kein Impressum nötig. Das ist keine Rechtsberatung.
- Makro- und Nährwertangaben sind Richtwerte und keine Ernährungsberatung.

## Datenschutz und Sicherheit

- Eine strenge Content Security Policy verbietet alle Verbindungen zu fremden Servern.
- Es werden keine Google Fonts geladen. Die App nutzt die Systemschriften von Apple (SF Pro und New York).
- Importierte Dateien werden geprüft. Texte werden nie als HTML ausgeführt, und nur echte, eingebettete Bilder werden übernommen.
- iOS kann Website-Daten bei Speicherknappheit löschen. Apps auf dem Home-Bildschirm sind davon deutlich weniger betroffen. Regelmäßige Backups bleiben trotzdem die einzige echte Absicherung.
