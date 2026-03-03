# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static single-page marketing site for MedBeacon (AI sepsis detection). No build system. Hosted on Netlify — pushes to `main` auto-deploy.

## Files

- **index.html** — all page content
- **styles.css** — mobile-first, BEM-like, breakpoints at 640px/960px
- **script.js** — nav, mobile menu, scroll-reveal, Netlify Forms submission
- **netlify.toml** — headers, caching, CSP

## Conventions

- CSS custom properties in `:root` for theming (`--accent: #e94452`)
- Font: Inter via Google Fonts
- Images in `images/` (AVIF for photos, PNG for logos)
