# Easy Notes — Projektstatus

**Stand:** 2. Oktober 2026  
**Version:** 0.1.0  
**Leitsatz:** Aufmachen. Schreiben. Weitergeben.

## 1. Wofür

Easy Notes ist das analoge Notizbuch in der Easy-Reihe. Die Einheit ist das Heft, nicht die einzelne Note. Stift, Marker und Radierer sitzen auf der Seite. Der Maschinentext-Export landet als `.md` neben der JSON, damit Easy Writing den Ordner öffnen kann.

## 2. Stack

- Tauri 2 + Svelte 5 + SvelteKit SPA (`adapter-static`, `ssr = false`)
- Vite-Port 1420
- Identifier `com.renejesser.easynotes`, Team `3LAHNFWNT3`
- Host-I/O nur in `$lib/host/`
- Tinte: Strich-JSON (`src/lib/ink/`). Gezeichnet wird auf eine Canvas, die nur wächst, wenn das Blatt wirklich länger wird
- iPad: PencilKit zeichnet den sichtbaren Ausschnitt. Beim Absetzen geht der Strich an dieselbe Stelle in die Canvas
- OCR: Apple Vision, auf dem Mac und auf dem iPad, lokal und offline

## 3. Dateien

```text
notizen/
  Studium/
    notebook.yaml
    2026-09-05-seminar.note.json
    2026-09-05-seminar.md
    easy-notes.lock.json
```

Kein Dot-Ordner. Lock im Heft-Root, wie Easy Writing. Umbenennen und Löschen in der App ändern Ordner und Dateien auf der Platte.

## 4. Seite

- Stift, drei Marker, Radierer, optionale Linien. Finger blättern, Stift schreibt
- Unter dem Text bleibt mindestens eine Bildschirmhöhe leeres Papier. Weiteres Blättern nach unten verlängert das Blatt
- Der Radierer löscht sichtbar sofort und schreibt die Striche erst beim Loslassen um
- Gespeichert wird etwa 1,5 Sekunden nach der letzten Bewegung. Das JSON entsteht neben dem Zeichen-Thread

## 5. Interop

- Easy Reading schreibt Beilagen (`inserts[]`) als `.note.json` in ein gewähltes Heft
- Easy Notes schreibt `.md` mit Frontmatter. Easy Writing entdeckt `.md`/`.mdx`

## 6. Grenzen

Kein PencilKit-Dateiformat, kein PDF-Export auf iOS, keine Zusammenführung wenn zwei Geräte denselben Eintrag schreiben (letzte Dropbox-Version gewinnt).
