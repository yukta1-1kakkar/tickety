# Bloub attribution

Source: https://github.com/jeremy-prt/bloub
Pinned revision: `b4bb3c1b5f93c7b87a2e8d620f667c4093d97749`
Copyright (c) 2026 Jérémy Perret. Distributed under the included MIT license.

These TypeScript files are vendored from `src/bot`. `eyefit.ts` has one local
performance adjustment: its preset-specific fit table is initialized lazily,
only if a known preset shape is used. Tickety's own rounded profile already
uses the upstream zero-correction path for custom profiles.

Tickety supplies its own green palette, silhouette, face poses, flight-path
badge, state mapping, DOM renderer, and animation lifecycle. This is a local
bundle of the engine, not an iframe or a remotely loaded script. Bloub's original
project is a recreation of the x.ai avatar; this adaptation has no affiliation
with or endorsement from x.ai. Upstream's MIT license covers its source code.

To regenerate `ui/mascot.js`, run `npm run build:mascot` in `extension` after
installing the existing frontend development dependencies. No network is used
by the build. The generated file is checked in so unpacked loading needs no build.
