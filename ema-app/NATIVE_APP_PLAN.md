# EMA App — Native iOS / Android Plan

This document describes the phase **after** the current package-native web/prototype sprint.

It answers a specific question:

- yes, the final product includes a real iOS app and a real Android app
- no, the project is not yet in the stage where Xcode and Android Studio are the main work surface

## Current Sequence

The intended delivery order is:

1. package-native protocol and participant runtime
2. backend and sync path
3. researcher dashboard
4. export semantics and end-to-end validation
5. native iOS/Android shell hardening
6. store/release preparation

The reason for this order is simple:

- native wrappers are expensive to stabilize
- changing the protocol/runtime/data model underneath them too early creates churn
- the native phase should start only once the package model and sync contract are stable

## What The Native Phase Includes

### iOS

- Capacitor iOS shell under Xcode
- local notification integration
- notification tap -> WebView bridge event
- background/foreground lifecycle wiring
- permission handling:
  - notifications
  - location, if enabled
- app icon, splash, signing, provisioning
- TestFlight distribution and device testing

### Android

- Capacitor Android shell under Android Studio
- local notification integration
- notification tap -> WebView bridge event
- background/foreground lifecycle wiring
- permission handling:
  - notifications
  - location, if enabled
- app icon, signing config, release build pipeline
- internal testing on real devices

### Cross-Platform Native Concerns

- bridge-event parity with the web runtime
- background sync expectations
- expiry checks while app is suspended/resumed
- offline persistence and recovery after process death
- native-safe error logging and diagnostics

## Entry Criteria For Native Work

The project should not move into the main native phase until these are true:

- package-based protocol is stable
- scheduler behavior is stable
- package-specific prompt launch is stable
- sync contract is implemented server-side
- normalized exports are understood and tested
- dashboard can author and push protocol versions

## Native Phase Milestones

### Milestone 1 — Shell Bootstrap

- `npx cap sync`
- verify iOS and Android shells build locally
- verify WebView app boots on device/simulator

### Milestone 2 — Notification And Launch Path

- local notification scheduling works on both platforms
- tapping a notification launches the correct package session
- package identity reaches the JS runtime intact

### Milestone 3 — Lifecycle And Persistence

- app survives background/foreground transitions
- prompt expiry logic remains correct after resume
- local data survives app restarts and offline periods

### Milestone 4 — Permissions And Context Collection

- notification permission UX is stable
- GPS/context permissions are handled correctly when enabled
- denied-permission states degrade gracefully

### Milestone 5 — Release Hardening

- signing/provisioning configured
- build flavors/environments configured
- crash/error diagnostics in place
- TestFlight / Play internal release path verified

## Tools For That Phase

When the project reaches the native phase, the main tools become:

- Xcode for iOS
- Android Studio for Android
- Capacitor CLI for shell sync/build plumbing

Until then, the main tools remain:

- the web/TypeScript runtime in `ema-app/app`
- backend implementation
- researcher dashboard implementation
- protocol and export contracts
