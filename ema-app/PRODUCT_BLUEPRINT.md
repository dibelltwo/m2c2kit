# EMA App — Product Blueprint

This blueprint describes the intended final products, not just the current dev prototype.

---

## 1. Product Set

There are two final user-facing products:

- **Participant App** (phone)
- **Researcher Dashboard** (web)

They are backed by the EMA API server and database.

---

## 2. Core Product Model

The app should no longer be treated as one fixed battery per prompt.

The correct model is:

- **Question Bank**
  - researcher-created EMA questions
  - each question has a stable `item_id`
  - question status is `active` or `hidden`
  - hidden questions are preserved historically and can be restored later

- **Cognitive Modules**
  - fixed module types:
    - `symbol-search`
    - `color-shapes`
    - `color-dots`
    - `grid-memory`
  - each package can use task-specific parameter presets

- **Packages**
  - researcher-named bundles of:
    - selected cognitive modules
    - selected EMA questions chosen question-by-question
  - a package may include only EMA, only cognition, or a mix
  - a package may include multiple survey groups

- **Package Versions**
  - package versions are immutable once used in collected data
  - edits create a new package version
  - prior sessions stay linked to the old version

- **Schedule Rules**
  - schedules target packages
  - examples:
    - `Morning Survey` -> morning fixed window
    - `Random Cognition` -> daytime random block
    - `Evening Mixed` -> evening window

---

## 3. Participant App Blueprint

### Screen Map

1. Setup / Enrollment
2. Standby / Home
3. Notification / Prompt Launch
4. Package Session Flow
5. Completion Screen

### Standby Screen

The standby screen should show visible package types, especially in coordinator/dev mode.

```text
+--------------------------------------------------+
| EMA Participant App                             |
| Study: Daily Mood Study                         |
| Participant: P-014                              |
| Protocol v5                                     |
+--------------------------------------------------+
| Next scheduled prompt                           |
|  Today 6:30 PM                                  |
|  Package: Evening Mixed                         |
+--------------------------------------------------+
| Available Packages                              |
|  [Morning Survey]                               |
|  [Random Cognition A]                           |
|  [Evening Mixed]                                |
|  [Weekly Full Battery]                          |
+--------------------------------------------------+
| Status                                          |
|  Sync: up to date                               |
|  Last completed: Today 9:12 AM                  |
+--------------------------------------------------+
```

Notes:

- In normal participant mode, package launch may be passive / scheduled only.
- In coordinator or dev mode, these package types can be manually launched.

### Prompt Launch

```text
+--------------------------------------------------+
| Prompt Ready                                     |
| Package: Morning Survey                          |
| Window expires in 28 minutes                     |
|                                                  |
| [Start Now]                                      |
+--------------------------------------------------+
```

### Package Session Flow

Package content is dynamic and package-specific.

Examples:

- `Morning Survey`
  - EMA only
- `Random Cognition A`
  - `symbol-search`
  - `color-dots`
- `Evening Mixed`
  - `grid-memory`
  - selected EMA questions

Flow:

```text
Package Start
  -> module 1
  -> module 2
  -> module 3
  -> EMA survey items
  -> completion
```

### EMA Survey Screen

Desired interaction:

- question prompt visible immediately
- slider or response control visible immediately
- skip action available on the top right
- participant must either answer or skip before completing the survey

```text
+--------------------------------------------------+
| How stressed do you feel right now?      [Skip] |
|                                                  |
| 0 ---------------------------------------- 100  |
| Not at all                         Extremely     |
|                                                  |
| [Next]                                           |
+--------------------------------------------------+
```

### Completion Screen

```text
+--------------------------------------------------+
| Completed                                         |
| Package: Evening Mixed                            |
| Thank you. Your responses have been saved.        |
|                                                    |
| [Return to Standby]                               |
+--------------------------------------------------+
```

---

## 4. Researcher Dashboard Blueprint

### Screen Map

1. Study Overview
2. Question Bank
3. Cognitive Presets
4. Package Builder
5. Schedule Builder
6. Participants / Compliance
7. Export Center

### Dashboard Home

```text
+--------------------------------------------------------------+
| Study Dashboard                               Daily Mood EMA |
+----------------------+---------------------------------------+
| Participants         | Compliance Summary                    |
|  42 active           | Response rate: 81%                    |
|  3 paused            | Completion rate: 76%                  |
|                      | Missed prompts: 19                    |
+----------------------+---------------------------------------+
| Packages             | Upcoming Rules                        |
|  Morning Survey      | Morning Survey -> 08:00               |
|  Random Cognition A  | Random Cognition -> 12:00-18:00       |
|  Evening Mixed       | Evening Mixed -> 18:00-21:00          |
+--------------------------------------------------------------+
```

### Question Bank

```text
+--------------------------------------------------------------+
| Question Bank                                                |
+--------------------------------------------------------------+
| Search [______________]                                      |
|                                                              |
| mood_now            slider     active    [Edit] [Hide]       |
| stress_now          slider     active    [Edit] [Hide]       |
| sleep_quality       single     hidden    [Edit] [Restore]    |
| energy_now          slider     active    [Edit] [Hide]       |
|                                                              |
| [Add Question]                                               |
+--------------------------------------------------------------+
```

Rules:

- use **Hide**, not delete
- hidden questions stay valid in historical data and old package versions

### Package Builder

```text
+--------------------------------------------------------------+
| Package Builder                                              |
+--------------------------------------------------------------+
| Package Name: [Evening Mixed______________________________]  |
| Version: 3                                                   |
|                                                              |
| Cognitive Modules                                            |
|  [x] Grid Memory      Params: [Edit]                         |
|  [ ] Color Shapes     Params: [Edit]                         |
|  [x] Symbol Search    Params: [Edit]                         |
|  [ ] Color Dots       Params: [Edit]                         |
|                                                              |
| EMA Questions                                                |
|  [x] mood_now                                                |
|  [x] stress_now                                              |
|  [x] energy_now                                              |
|  [ ] sleep_quality                                           |
|                                                              |
| [Save New Version]                                           |
+--------------------------------------------------------------+
```

### Schedule Builder

```text
+--------------------------------------------------------------+
| Schedule Builder                                             |
+--------------------------------------------------------------+
| Rule 1                                                       |
|  Package: Morning Survey                                     |
|  Type: Fixed window                                          |
|  Time: 08:00 - 10:00                                         |
|                                                              |
| Rule 2                                                       |
|  Package: Random Cognition A                                 |
|  Type: Random block                                          |
|  Time blocks: 12:00-15:00, 16:00-18:00                       |
|  Prompts/day: 2                                              |
|                                                              |
| Rule 3                                                       |
|  Package: Evening Mixed                                      |
|  Type: Fixed window                                          |
|  Time: 18:00 - 21:00                                         |
+--------------------------------------------------------------+
```

### Participant Compliance

```text
+--------------------------------------------------------------+
| Participant: P-014                                           |
+--------------------------------------------------------------+
| Scheduled: 64   Completed: 51   Missed: 8   Expired: 5       |
| Response Rate: 79.7%                                         |
|                                                              |
| Recent Packages                                              |
|  Morning Survey       completed                              |
|  Random Cognition A   missed                                 |
|  Evening Mixed        completed                              |
+--------------------------------------------------------------+
```

### Export Center

```text
+--------------------------------------------------------------+
| Export Center                                                |
+--------------------------------------------------------------+
| Export Type: [CSV v]                                         |
| Include hidden questions: [x]                                |
| Include package versions: [x]                                |
|                                                              |
| Notes                                                        |
| - Empty value = question not active in that package version  |
| - "skipped" = participant explicitly skipped                 |
|                                                              |
| [Create Export Job]                                          |
+--------------------------------------------------------------+
```

---

## 5. System Blueprint

```text
 Researcher Dashboard
   |  edits questions, packages, schedules
   v
 EMA API Server + DB
   |  serves protocol / package versions
   v
 Participant App
   |  schedules prompts, runs package flows, stores local data
   v
 Sync / Export Pipeline
   |  uploads package-versioned results
   v
 Dashboard Compliance + Exports
```

---

## 6. Data Rules

- Never delete questions used in data collection
- Use `hidden` instead of delete
- Package edits create new versions
- Old sessions keep old package versions
- Exports flatten all active and historical question IDs across versions
- Empty export cell means question was not active in that version
- `skipped` means the participant explicitly skipped

---

## 7. What Is Prototype-Only Right Now

The current browser prototype is a working draft of participant-app logic.

It is **not yet**:

- the final native phone UI
- the final researcher dashboard
- the final production-connected backend experience

It is currently useful for:

- validating package/session behavior
- validating survey UX
- validating setup logic
- validating scheduling concepts
