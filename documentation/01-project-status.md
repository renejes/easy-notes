# Easy Notes — Projektstatus

**Stand:** 5. September 2026  
**Version:** 0.1.0  
**Leitsatz:** Aufmachen. Schreiben. Weitergeben.

## 1. Wofür

Easy Notes ist das analoge Notizbuch in der Easy-Reihe. Die Einheit ist das Heft, nicht die einzelne Note. Stift, Marker und Radierer kommen aus Easy Reading. Der Maschinentext-Export landet als `.md` neben der JSON, damit Easy Writing den Ordner öffnen kann.

## 2. Stack

- Tauri 2 + Svelte 5 + SvelteKit SPA (`adapter-static`, `ssr = false`)
- Vite-Port 1420
- Identifier `com.renejesser.easynotes`, Team `3LAHNFWNT3`
- Host-I/O nur in `$lib/host/`
- Tinte: Web-Canvas + JSON (`src/lib/ink/`)
- OCR: Vision auf dem Mac, PencilKit `PKStrokeRecognizer` auf iPadOS 27, Vision-Fallback sonst

## 3. Dateien

```text
notizen/
  Studium/
    notebook.yaml
    2026-09-05-seminar.note.json
    2026-09-05-seminar.md
    easy-notes.lock.json
```

# Easy Notes — Projektstatus

**Stand:** 5. September 2026  
**Version:** 0.1.0  
**Leitsatz:** Aufmachen. Schreiben. Weitergeben.

## 1. Wofür

Easy Notes ist das analoge Notizbuch in der Easy-Reihe. Die Einheit ist das Heft, nicht die einzelne Note. Stift, Marker und Radierer kommen aus Easy Reading. Der Maschinentext-Export landet als `.md` neben der JSON, damit Easy Writing den Ordner öffnen kann.

## 2. Stack

- Tauri 2 + Svelte 5 + SvelteKit SPA (`adapter-static`, `ssr = false`)
- Vite-Port 1420
- Identifier `com.renejesser.easynotes`, Team `3LAHNFWNT3`
- Host-I/O nur in `$lib/host/`
- Tinte: Web-Canvas + JSON (`src/lib/ink/`)
- OCR: Vision auf dem Mac, PencilKit `PKStrokeRecognizer` auf iPadOS 27, Vision-Fallback sonst

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

## 4. Interop

- Easy Reading schreibt Beilagen (`inserts[]`) als `.note.json` in ein gewähltes Heft.
- Easy Notes schreibt `.md` mit Frontmatter. Easy Writing entdeckt `.md`/`.mdx`.

## 5. Grenzen

Kein PencilKit-Speicher, kein PDF-Export auf iOS, keine Merge wenn zwei Stifte denselben Eintrag schreiben (letzte Dropbox-Version gewinnt).


## 4. Interop

- Easy Reading schreibt Beilagen (`inserts[]`) als `.note.json` in ein gewähltes Heft.
- Easy Notes schreibt `.md` mit Frontmatter. Easy Writing entdeckt `.md`/`.mdx`.

## 5. Grenzen

Kein PencilKit-Speicher, kein PDF-Export auf iOS, keine Merge wenn zwei Stifte denselben Eintrag schreiben (letzte Dropbox-Version gewinnt).
