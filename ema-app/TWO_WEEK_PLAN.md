# EMA App — Two Week Execution Plan

This is the active implementation plan for the current sprint.

Important scope note:

- this sprint is focused on the package-native EMA system
- this sprint does **not** yet mean full native product hardening in Xcode or Android Studio
- native iOS/Android shell work is a later phase after the protocol, backend, dashboard, and sync path are stable

## Current State Entering This Sprint

Already in place:

- package-aware protocol contract
- package-aware scheduler prototype
- package-first setup/editor flow
- package-specific prompt launch in the dev participant app
- survey normalization with explicit `answered` vs `skipped`

Still incomplete:

- backend implementation
- researcher dashboard implementation
- package/version-aware exports
- native shell hardening for production iOS and Android

## Week 1

### Day 1

- lock the package-native contract as canonical:
  - question bank
  - named packages
  - schedule rules
  - default package behavior
- review remaining legacy fallback fields:
  - `assessments`
  - `ema_survey`
  - `schedule`

### Day 2

- finish package-aware runtime cleanup:
  - ensure scheduler uses `schedule_rules` everywhere
  - ensure prompt/session launch carries package identity end to end
  - ensure expiry and compliance use rule-specific timing

### Day 3

- finish setup-flow quality:
  - package editing UX
  - question hide/restore semantics
  - validation for duplicate IDs and invalid package/rule references
  - stable preview output

### Day 4

- finish local participant-app persistence:
  - package IDs in prompt/session state
  - package version handling
  - local response storage consistency

### Day 5

- define and start backend implementation:
  - participant enrollment
  - protocol retrieval
  - package-aware uploads
  - sync status endpoint

## Week 2

### Day 6

- implement backend storage for:
  - question versions
  - package versions
  - schedule rules
  - prompt logs
  - survey item responses

### Day 7

- implement researcher dashboard skeleton:
  - study overview
  - question bank
  - package builder
  - schedule builder

### Day 8

- connect dashboard to backend:
  - load protocol
  - push new protocol versions
  - inspect participant compliance

### Day 9

- implement export semantics:
  - hidden questions retained historically
  - empty = not active yet
  - skipped = explicit skip
  - package/version history remains interpretable

### Day 10

- end-to-end system validation:
  - researcher creates package/rule configuration
  - participant receives package-driven prompt
  - package runs correctly
  - data syncs to backend
  - export remains interpretable

## Out Of Scope For This Sprint

These items are planned next, but are not the current main implementation target:

- full Xcode iOS product build-out
- full Android Studio product build-out
- signing, provisioning, store packaging, and release workflow
- native background execution hardening for production deployment

## Definition Of Done For This Sprint

- package-based protocol is the canonical implementation
- participant app can launch package-specific sessions
- researcher can define and name packages and rules
- questions can be hidden instead of deleted
- historical data remains intact across edits
- backend and export path support package/version history
- the system is ready to enter the dedicated native iOS/Android hardening phase
