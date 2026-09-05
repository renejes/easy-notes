# Easy Notes

**Aufmachen. Schreiben. Weitergeben.**

Analoge Notizbücher auf dem iPad: ein Heft pro Thema, Stift auf der Seite, Dateien in Dropbox. Handschrift wird auf Wunsch zu Markdown — und landet dort, wo Easy Writing sie erwartet.

[![License: MIT](https://img.shields.io/badge/license-MIT-111111?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2-111111?style=flat-square)](https://v2.tauri.app)
[![Svelte](https://img.shields.io/badge/Svelte-5-111111?style=flat-square)](https://svelte.dev)
[![macOS](https://img.shields.io/badge/platform-macOS-111111?style=flat-square)](#entwickeln)
[![iPad](https://img.shields.io/badge/platform-iPad-111111?style=flat-square)](#ipad)

> v0.1.0 · macOS und iPad · [MIT](LICENSE)

---

## Easy-Reihe

Kleine Tools für ein Problem, das ich schon länger hatte. Nicht overengineered. Einfaches Design, wichtige Dinge sichtbar. Easy eben.

| App | Leitsatz | Wofür |
|-----|----------|--------|
| **[Easy Writing](https://github.com/renejes/easy-writing)** | Aufmachen. Schreiben. Speichern. Exportieren. | Markdown/MDX in einem Ordner. Der Satz gehört woanders hin. |
| **[Easy Reading](https://github.com/renejes/easy-reading)** | Aufmachen. Lesen. Arbeiten. | Thalia-EPUBs und Uni-PDFs wie auf Papier. Stift, Marker, Beilage. |
| **[Easy Training](https://github.com/renejes/easy-training)** | Plan. Satz. Fertig. | Trainingsplan auf dem iPad. Kein Abo, kein Account. |
| **Easy Notes** | Aufmachen. Schreiben. Weitergeben. | Analoges Notizbuch. Stift. Maschinentext für Easy Writing. |

Gleiche Haltung, gleiches Gesicht: IBM Plex Mono, Weiß auf Schwarz, Haarlinien, große Trefferflächen. Kein Dark Mode, keine Accounts, keine Cloud-API. Dropbox ist der Ordner auf der Platte.

Easy Notes steht **zwischen** Reading und Writing. Reading liefert den Stift. Writing den Export-Vertrag. Notes die Heft-Metapher — und den Weg von der Beilage zum Maschinentext.

---

## Workflow

Drei Apps, drei gebundene Ordner. Interop läuft über Dateien, nicht über eine gemeinsame Cloud.

```text
Easy Reading                    Easy Notes                     Easy Writing
───────────                     ──────────                     ────────────
Lesen/                          Notizen/                       Schreiben/
  Uni/Skript.pdf                  Studium/                       hausarbeit/
  .easy-reading/ink/…               notebook.yaml                  chapters/…
                                    2026-09-05-seminar.note.json
                                    2026-09-05-seminar.md   ──►  öffnen
         │
         │  Beilagen nach Easy Notes
         ▼
                              Studium/…note.json
```

**1. Lesen.** In Easy Reading liegt die Bibliothek. Stift und Marker auf der Buchseite. Was nicht ins Buch gehört, kommt auf ein **Beilageblatt** — der Zettel daneben.

**2. Weitergeben.** Auf dem Startschirm von Easy Reading: **Beilagen nach Easy Notes**. Du wählst ein Heft (oder den Notizen-Ordner; dann entsteht das Heft „Aus dem Lesen“). Die Beilagen werden als `.note.json` kopiert, Strokes unverändert, Herkunft im `source`-Feld. Schon importierte Blätter werden übersprungen.

**3. Schreiben.** In Easy Notes ist das die Seite im Heft. Stift, drei Marker, Radierer — dieselben wie in Reading. Die Seite wächst nach unten.

**4. Maschinentext.** **Als Text** erkennt die Handschrift lokal (auf dem Gerät, offline). Du prüfst den Text, dann liegt `….md` neben der JSON. Easy Writing öffnet diesen Ordner; `.md` reicht, ein Extra-Importer braucht es nicht.

Mac und iPad binden **denselben** Dropbox-Ordner. Umbenennen und Löschen in der App ändern Ordner und Dateien auf der Platte. Dropbox synct die Namen mit.

---

## Wofür

Ein Notizbuch für allgemeine Gedanken, eines fürs Studium. Keine Inbox aus einzelnen Notes. Im Heft schlägt man eine neue Seite auf.

Paplo und Endless Paper können Stift. Sie können nicht den Weg Reading → Notes → Writing. Deshalb gibt es Easy Notes.

## Was es kann

- **Regal** — einmal den Dropbox-Ordner binden, Notizbücher als Liste
- **Heft** — Index der Einträge, neues Blatt aufschlagen
- **Seite** — weißes Blatt, vertikal endlos. Apple Pencil schreibt, Finger blättert
- **Stift, Marker, Radierer** — Bleistift `#111`, gelb / pink / orange, Radierer
- **Umbenennen und Löschen** — Titel und Dateiname/Ordner auf der Platte, damit Mac und iPad nicht auseinanderlaufen
- **Als Text** — Erkennung auf dem Gerät, Prüffenster, `.md` mit Frontmatter
- **Lock** — `easy-notes.lock.json` im Heft, weich, wie Easy Writing

## Ordner auf der Platte

Kein versteckter Dot-Ordner (iOS Files / Dropbox macht daraus Müll). Jedes Heft ist ein sichtbarer Ordner.

```text
dropbox/notizen/
  Gedanken/
    notebook.yaml
    2026-09-05-spaziergang.note.json
  Studium/
    notebook.yaml
    2026-09-05-seminar.note.json
    2026-09-05-seminar.md
    easy-notes.lock.json
```

`notebook.yaml` ist die Kladde des Hefts — analog zu `project.yaml` in Easy Writing. Eine Seite ist eine Datei. Dropbox synct kleine Dateien; zwei Geräte im selben Heft kollidieren seltener als bei einer Riesen-JSON.

## iPad

Heimatgerät. Dieselbe App, derselbe Dropbox-Ordner (Files-App). Stift schreibt, Finger scrollt.

Installieren über **USB**, ohne gemeinsames WLAN:

```bash
npm run ios:device
```

iPad angesteckt, vertraut, Entwicklermodus an. `tauri ios dev --host …` braucht ein gemeinsames Netz und ist nur für Hot-Reload.

## Entwickeln

Voraussetzungen: **macOS**, [Node.js](https://nodejs.org) 20+, [Rust](https://rustup.rs) (stable).

```bash
git clone https://github.com/renejes/easy-notes.git
cd easy-notes
npm install
npm run tauri dev
```

Weitere Befehle:

```bash
npm run check                          # svelte-check
npm run ios:device                     # iPad per USB, gebündeltes Frontend
npm run macos:release                  # signiertes, notariertes DMG (braucht Apple-ID-Env)
```

Tauri-Imports liegen nur in `$lib/host/`. Der Stift ist Web-Canvas plus JSON, nicht PencilKit als Speicher. OCR: Vision auf dem Mac; auf dem iPad `PKStrokeRecognizer` (iPadOS 27) mit Vision-Fallback.

Technischer Stand: [`documentation/01-project-status.md`](documentation/01-project-status.md).

## Status

Schreibbereit auf **macOS** und **iPad**: Regal, Heft, Eintrag, Dropbox, Umbenennen, Löschen, Export als Text.

**Absichtlich nicht in v0.1:** Tags, Sticker, PDF-Annotation, Suche in Handschrift, Dark Mode, Accounts, PencilKit als Dateiformat, Live-Merge wenn zwei Stifte denselben Eintrag schreiben (letzte Dropbox-Version gewinnt).

## Mitmachen

Issues und Pull Requests sind willkommen, wenn sie beim nächsten Satz / der nächsten Seite helfen. Cover-Shop, KI-Chat oder ein zweites Chrome-Theme gehört nicht in diese App.

## Lizenz

[MIT](LICENSE) © 2026 René Jesser
