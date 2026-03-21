# EMA App — Agent Team

This document defines the agent team for building the Ecological Momentary Assessment (EMA) app on top of m2c2kit. Each agent owns a vertical slice of the system and coordinates via shared contracts defined by the Protocol Architect.

---

## Team Overview

```
                    ┌─────────────────────┐
                    │  Protocol Architect  │  ← defines all shared contracts
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                       │
┌───────▼───────┐   ┌──────────▼────────┐   ┌─────────▼──────────┐
│  Assessment   │   │  Native Platform  │   │  Setup UI          │
│  Engineer     │   │  Engineer         │   │  Engineer          │
└───────┬───────┘   └──────────┬────────┘   └────────────────────┘
        │                      │
┌───────▼───────┐   ┌──────────┼──────────┐
│  Assessment   │   │                     │
│  Review Agent │  ┌▼───────────┐  ┌──────▼─────────────┐
└───────────────┘  │  Scheduler &│  │  Data & Sync        │
                   │  Compliance │  │  Engineer           │
                   └────────────┘  └─────────┬──────────┘
                                             │
                                    ┌────────▼───────┐
                                    │   Backend      │
                                    │   Engineer     │
                                    └────────────────┘
```

---

## Agents

| #   | Agent                             | File                                         | Primary Concern                                              |
| --- | --------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| 0   | **Protocol Architect**            | `agents/00-protocol-architect.md`            | Shared contracts, schemas, interfaces                        |
| 1   | **Assessment Engineer**           | `agents/01-assessment-engineer.md`           | m2c2kit cognitive tasks & surveys                            |
| 2   | **Native Platform Engineer**      | `agents/02-native-platform-engineer.md`      | Capacitor, Android, iOS, GPS, background                     |
| 3   | **Scheduler & Compliance**        | `agents/03-scheduler-compliance.md`          | Notification scheduling, EMA protocol, compliance            |
| 4   | **Data & Sync Engineer**          | `agents/04-data-sync-engineer.md`            | On-device DB schema, server sync, prompt log                 |
| 5   | **Backend Engineer**              | `agents/05-backend-engineer.md`              | REST API, server DB, participant management                  |
| 6   | **Setup UI Engineer**             | `agents/06-setup-ui-engineer.md`             | Study configuration screen, assessment picker                |
| 7   | **Assessment Review Agent**       | `agents/07-assessment-review-agent.md`       | Audit assessments for EMA correctness, produce review report |
| 8   | **Researcher Dashboard Engineer** | `agents/08-researcher-dashboard-engineer.md` | Researcher-facing dashboard, protocol review, exports        |

---

## Shared Contract Files (source of truth)

All agents read these — only Protocol Architect writes them:

```
ema-app/contracts/
  study-protocol.schema.json     ← study protocol JSON schema
  prompt-log.schema.json         ← prompt/compliance event schema
  context-snapshot.schema.json   ← GPS + sensor data schema
  api.openapi.yaml               ← backend REST API contract
  bridge-events.ts               ← JS↔native message types
```

---

## Development Phases

| Phase                  | Lead Agent                           | Supporting Agents  |
| ---------------------- | ------------------------------------ | ------------------ |
| 1 — Contracts          | Protocol Architect                   | all review         |
| 2 — Assessment + Shell | Assessment Engineer, Native Platform | —                  |
| 3 — Scheduling         | Scheduler & Compliance               | Native Platform    |
| 4 — Data Layer         | Data & Sync, Backend                 | Native Platform    |
| 5 — Setup UI           | Setup UI                             | Protocol Architect |
| 6 — Integration        | all                                  | —                  |

---

## Inter-Agent Handoff Rules

- **Never** modify a file owned by another agent without flagging it first.
- **Contract changes** go through Protocol Architect — no agent edits `contracts/` directly.
- **Native bridge events** (`bridge-events.ts`) are the seam between JS agents (1, 3, 6) and the native agent (2). Agree on event shapes before implementing either side.
- **API contracts** (`api.openapi.yaml`) are the seam between Data & Sync (4) and Backend (5). Backend implements what the contract says; Sync calls what the contract says.
