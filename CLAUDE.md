# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## Project overview

This is the marketing website for **«ДИМ МОРОЗИВА»** ("House of Ice Cream"),
a Ukrainian artisanal ice-cream brand. It is a single-page, static,
client-side website with no build step, no backend, and no dependencies to
install. The entire site lives in one file.

The primary audience-facing language is **Ukrainian** (`lang="uk"`). All
user-visible copy, headings, button labels, and AI prompts are written in
Ukrainian. Keep new content in Ukrainian unless explicitly asked otherwise.

## Repository structure

```
.
├── index.html   # The entire website: markup, inline CSS, and inline JS
└── CLAUDE.md    # This file
```

That is the whole repository — a single `index.html`. There are no other
source files, config files, package manifests, or assets.

### Anatomy of `index.html`

The file is organized top to bottom as:

1. **`<head>` / `<style>`** — All CSS lives in one inline `<style>` block.
   - A `:root` block defines the design tokens (CSS custom properties) used
     throughout — see "Design conventions" below.
   - Styles are grouped by section with comment banners
     (e.g. `/* --- Header --- */`, `/* --- Products Section --- */`).
   - Fonts come from Google Fonts (`Montserrat`), loaded via `<link>`.
2. **`<body>`** — Semantic sections, each an `<section>` with an `id` used
   for in-page anchor navigation:
   - `#about` — Brand story / values.
   - `#products` — Product card grid (`.product-grid` / `.product-card`).
   - `#gemini-ideas` — Two interactive AI generators (flavor + recipe).
   - `#where-to-buy` — Partner locations, reusing the product-card grid.
   - `#contacts` — Address, phone, email, and an embedded Google Map.
   - `#privacy-policy` and `#terms-of-service` — Legal copy.
   - `<footer>` — Company legal info (EDRPOU code) and legal links.
3. **`<script>`** — All JavaScript lives in one inline `<script>` block at the
   bottom of `<body>`. It powers the Gemini API integration only.

## Tech stack

- Plain **HTML5**, **CSS3**, and **vanilla JavaScript** (ES2017+ — uses
  `async`/`await`, `fetch`, template literals). No frameworks, no bundler,
  no transpiler.
- **Google Fonts** (`Montserrat`) loaded at runtime.
- **Google Gemini API** (`gemini-2.5-flash-preview-05-20`) called directly
  from the browser for the two idea-generator features.
- **Google Maps embed** via `<iframe>`.

## How to run / develop

There is no build, install, or test step. To preview the site, open
`index.html` in a browser, or serve the directory statically, e.g.:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Because everything is in one file, "the change" and "the deploy artifact"
are the same file — edit `index.html` directly.

## Design conventions

- **Theme via CSS variables.** Always use the existing custom properties
  rather than hard-coding colors. Current palette (defined in `:root`):
  - `--bg-color: #fdfaf6` (page background)
  - `--text-color: #3a3a3a`
  - `--primary-color: #a7c7e7` (pastel blue — headings, accents)
  - `--secondary-color: #f0e6d2` (light cream — borders)
  - `--darker-text: #5c5c5c`
  - `--footer-bg: #f5f5f5`
  - `--button-bg: #89b0d9` / `--button-hover-bg: #7c9fbf`
- **Aesthetic:** soft pastel, rounded corners (`border-radius: 8px`), subtle
  shadows, and `transition`-based hover effects. Match this when adding UI.
- **Layout:** centered `.container` capped at `max-width: 960px`; sections use
  the `.section` class for consistent vertical padding and dividers.
- **Responsive:** uses CSS Grid with `auto-fit`/`minmax` and a `@media
  (min-width: 768px)` breakpoint. Keep new layouts mobile-first and fluid.
- **Reuse existing classes** (`.product-card`, `.gemini-button`, `.result-box`,
  etc.) instead of introducing one-off styles.

## JavaScript conventions

- All scripting is the Gemini integration in the single inline `<script>`.
- Element references are grabbed once at the top with `getElementById`.
- `callGeminiAPI(prompt, resultBox, button)` is the shared entry point: it
  toggles a `.loader` spinner, disables the button during the request, and
  retries up to 3 times with **exponential backoff** on failure.
- API responses are rendered into the `<p>` inside a `.result-box`, with
  `\n` converted to `<br>`.
- User-facing error/validation messages are in Ukrainian.
- The prompts sent to Gemini are carefully worded brand-voice prompts (a
  "creative technologist" / "pastry chef" persona) and request a specific
  output format. Preserve that structure and the Ukrainian language when
  editing prompts.

### API key handling

The Gemini `apiKey` constant in the script is intentionally an **empty
string** with the comment "This will be handled by the environment." Do **not**
commit a real API key into `index.html` — it is a public, client-side file and
any embedded key would be exposed. If wiring up a key, do it through an
external/injected mechanism, not a hard-coded literal.

## Known issues / gotchas

- **Duplicated document scaffolding.** `index.html` currently contains a
  nested/duplicated outer `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>`
  wrapper (around lines 1–8 and the trailing closing tags). The real content
  uses the inner `lang="uk"` document. This is malformed but browsers tolerate
  it. If you touch the top or bottom of the file, consider cleaning this up —
  but do not let an unrelated edit accidentally rely on the outer wrapper.
- The page `<title>` in the inner document is the correct branded title; the
  stray outer `<head>` has a placeholder `<title>Title</title>`.

## Git & workflow conventions

- Active development branch for AI-assisted work: `claude/claude-md-docs-pjhlh2`.
  Develop on the designated feature branch; never push directly to `main`
  without explicit permission.
- Commit history so far uses short, imperative messages
  (e.g. "Update index.html"). Keep commit messages clear and descriptive.
- Do **not** open a pull request unless explicitly asked.
- Push with `git push -u origin <branch-name>`.

## Working guidelines for AI assistants

- Keep all user-facing text in **Ukrainian**.
- Preserve the single-file, dependency-free architecture unless the user
  explicitly asks to restructure the project.
- Reuse existing CSS variables and component classes; match the established
  pastel visual style.
- Never hard-code secrets (API keys) into this public client-side file.
- When changing copy, respect the legal sections (privacy policy, terms,
  company EDRPOU `32432161`) — these are real business details.
