# Easy Notes

**Aufmachen. Schreiben. Weitergeben.**

Analoge Notizbücher auf dem iPad: ein Heft pro Thema, Stift auf der Seite, Dateien in Dropbox. Handschrift wird auf Wunsch zu Markdown für Easy Writing.

[![License: MIT](https://img.shields.io/badge/license-MIT-111111?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2-111111?style=flat-square)](https://v2.tauri.app)
[![Svelte](https://img.shields.io/badge/Svelte-5-111111?style=flat-square)](https://svelte.dev)
[![macOS](https://img.shields.io/badge/platform-macOS-111111?style=flat-square)](#entwickeln)
[![iPad](https://img.shields.io/badge/platform-iPad-111111?style=flat-square)](#ipad)

> v0.1.0 · macOS und iPad · [MIT](LICENSE)

---

## Easy-Reihe

Kleine Tools für ein Problem. Nicht overengineered. IBM Plex Mono, Weiß auf Schwarz, Haarlinien.

| App | Wofür |
|-----|--------|
| **[Easy Writing](https://github.com/renejes/easy-writing)** | Aufmachen. Schreiben. Speichern. Exportieren. Markdown/MDX in einem Ordner. |
| **[Easy Reading](https://github.com/renejes/easy-reading)** | Aufmachen. Lesen. Arbeiten. Thalia-EPUBs und Uni-PDFs wie auf Papier. |
| **Easy Notes** | Aufmachen. Schreiben. Weitergeben. Analoges Notizbuch, Stift, Maschinentext. |

## Wofür

Ein Notizbuch für allgemeine Gedanken, eines fürs Studium. Keine Inbox aus einzelnen Notes. Im Heft schlägt man eine neue Seite auf. Der Stift, drei Marker und der Radierer sind dieselben wie in Easy Reading.

Easy Reading kann Beilageblätter als Einträge hierher schreiben. Easy Notes erkennt die Handschrift lokal und legt eine `.md` daneben — die öffnet Easy Writing.

## Was es kann

- **Ordner binden** — ein Dropbox-Ordner ist das Regal
- **Notizbücher** — jeder Unterordner mit `notebook.yaml` ist ein Heft
- **Einträge** — eine `.note.json` pro Seite, vertikal endlos
- **Stift, Marker, Radierer** — Bleistift, gelb / pink / orange, Radierer
- **Als Text** — Erkennung auf dem Gerät, Prüffenster, `.md` neben der JSON
- **Sync** — Dateien liegen im gebundenen Ordner und fahren mit Dropbox mit

## Ordner auf der Platte

```text
dropbox/notizen/
  Gedanken/
    notebook.yaml
    2026-09-05-a.note.json
  Studium/
    notebook.yaml
    2026-09-05-seminar.note.json
    2026-09-05-seminar.md
```

## iPad

Dieselbe App, derselbe Dropbox-Ordner (Files-App). Stift schreibt, Finger blättert.

```bash
npm run ios:device
```

## Entwickeln

Voraussetzungen: **macOS**, [Node.js](https://nodejs.org) 20+, [Rust](https://rustup.rs) (stable).

```bash
git clone https://github.com/renejes/easy-notes.git
cd easy-notes
npm install
npm run tauri dev
```

Tauri-Imports liegen nur in `$lib/host/`. Der Stift ist Web-Canvas plus JSON, nicht PencilKit als Speicher.

Technischer Stand: [`documentation/01-project-status.md`](documentation/01-project-status.md).

## Status

Schreibbereit auf **macOS** und **iPad**: Regal, Heft, Eintrag, Dropbox, Export als Text.

**Absichtlich nicht in v0.1:** Tags, Sticker, PDF-Annotation, Dark Mode, Accounts, PencilKit als Dateiformat.

## Lizenz

[MIT](LICENSE) © 2026 René Jesser
# easy-notes
