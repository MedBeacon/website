# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedBeacon marketing site — a static single-page site for an AI-powered sepsis detection platform. No build system, no bundler, no package manager.

## Architecture

Three source files at the root:

- **index.html** — Single-page layout with sections: Hero, Stats, Solution, Features, Comparison, Capabilities, How It Works, About (team), Contact
- **styles.css** — Mobile-first CSS using BEM-like naming (`.block__element--modifier`). CSS custom properties defined in `:root` for colors, spacing, and typography. Breakpoints at 640px (tablet) and 960px (desktop)
- **script.js** — Vanilla JS: nav scroll effect, mobile menu toggle, IntersectionObserver scroll-reveal animations, and Netlify Forms contact form submission via fetch

## Development

No build step. Open `index.html` directly or use any local server (e.g., `python3 -m http.server`). No tests or linting configured.

## Deployment

Hosted on **Netlify**. The contact form uses Netlify Forms (`data-netlify="true"` attribute with honeypot spam protection). Pushes to `main` trigger production deploys; the `redesign` branch gets branch deploys.

## Conventions

- Font: Inter (loaded from Google Fonts)
- Accent color: `--accent: #e94452` (red)
- Warm background sections alternate with white (`--bg-warm: #f2e9d7`)
- Images: AVIF for team photos, PNG for logos and app screenshots, stored in `images/`
- `wix/` directory contains old site assets and is gitignored
