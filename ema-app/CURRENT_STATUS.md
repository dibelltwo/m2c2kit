# EMA App — Current Status

Last updated: 2026-03-21

## Canonical Product Direction

The EMA app is now defined as a **package-based research system**, not a single fixed battery per prompt.

Core model:

- fixed cognitive module library:
  - `symbol-search`
  - `color-shapes`
  - `color-dots`
  - `grid-memory`
- editable EMA question bank
- researcher-defined named packages
- schedule rules that target packages
- versioned history for questions and packages
- questions should be **hidden**, not deleted

## What Is Already Implemented

- protocol-driven EMA survey generation
- explicit survey item normalization with `answered` vs `skipped`
- `prompt_id` / `protocol_version` carried through survey records
- package-aware scheduler prototype with package/rule IDs carried on prompts
- setup flow now authors:
  - question bank
  - named packages
  - package-to-rule mappings
  - study start/end dates
- researcher dashboard scaffold exists in:
  - `ema-app/dashboard/`
- backend server scaffold exists in:
  - `ema-app/server/`
  - uploads and prototype state persist to `ema-app/server/data/state.json`
  - an optional Prisma/Postgres slice now exists for studies, protocol versions, participants, and export jobs
- start/end date fields in setup flow
- dev prototype can run:
  - single assessments
  - full prompt sessions
  - package-specific prompt sessions
- participant standby state exists in dev flow
- terminal status helper exists in:
  - `ema-app/scripts/status.mjs`
- product blueprint exists in:
  - `ema-app/PRODUCT_BLUEPRINT.md`

## Important Current Limitation

The implementation still carries legacy back-compat fields:

- one top-level `assessments` list
- one top-level `ema_survey`
- one top-level `schedule`

These are now derived fallback fields, but the broader runtime, exports, and backend are not yet fully package-native end to end.

## What Today Clarified

- standby screen should show package types
- packages are researcher-editable and researcher-named
- EMA questions are selected question-by-question
- cognitive modules support task-specific parameters per package
- a package may include multiple EMA groups
- hide/restore is preferred over delete
- old data must remain intact after edits

## Launch-Critical Work Still Remaining

- finish researcher dashboard implementation
- complete the move from file-backed backend persistence to real database-backed implementation
- implement package-aware export semantics
- native mobile shell / store-release path

## Native Build Clarification

The final product includes native iOS and Android apps, but the project is not yet in the main Xcode / Android Studio implementation phase.

Current priority order:

- package-native participant runtime
- backend and sync path
- researcher dashboard
- export semantics
- native iOS / Android hardening and release path

Native-phase plan lives in:

- `ema-app/NATIVE_APP_PLAN.md`

## Current Prototype Meaning

The current browser prototype is:

- a working implementation draft
- useful for validating participant app behavior
- not the final native app UI
- not the final dashboard UI
