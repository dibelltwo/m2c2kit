export const dashboardStyles = `
:root {
  --bg: #f2eee6;
  --panel: #fffaf2;
  --panel-strong: #f7f0e1;
  --ink: #1e2a28;
  --muted: #6f766f;
  --line: #d7ccb8;
  --accent: #1f6f52;
  --accent-2: #bb5a2b;
  --warning: #9f5226;
  --shadow: 0 18px 45px rgba(40, 35, 24, 0.12);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: Georgia, "Times New Roman", serif;
  color: var(--ink);
  background:
    radial-gradient(circle at top left, rgba(31, 111, 82, 0.15), transparent 25%),
    radial-gradient(circle at top right, rgba(187, 90, 43, 0.12), transparent 28%),
    var(--bg);
}

button,
input,
select,
textarea {
  font: inherit;
}

.dashboard-shell {
  min-height: 100vh;
  padding: 28px;
}

.dashboard-frame {
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  gap: 18px;
}

.hero,
.page-panel,
.metric-card,
.sidebar {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 24px;
  box-shadow: var(--shadow);
}

.hero {
  padding: 26px 28px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
}

.hero h1,
.page-panel h2,
.metric-card h3,
.sidebar h3 {
  margin: 0;
}

.hero p,
.page-panel p,
.metric-card p,
.sidebar p,
.list-table td,
.list-table th,
.muted {
  color: var(--muted);
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--panel-strong);
  border: 1px solid var(--line);
  color: var(--accent);
  font-size: 14px;
}

.layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
}

.sidebar {
  padding: 18px;
  display: grid;
  gap: 18px;
  align-content: start;
}

.nav-stack,
.stack {
  display: grid;
  gap: 10px;
}

.nav-btn,
.action-btn,
.ghost-btn {
  border-radius: 14px;
  border: 1px solid var(--line);
  padding: 12px 14px;
  cursor: pointer;
}

.nav-btn {
  text-align: left;
  background: transparent;
  color: var(--ink);
}

.nav-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.action-btn {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.ghost-btn {
  background: transparent;
  color: var(--accent-2);
}

.page-panel {
  padding: 22px;
  display: grid;
  gap: 18px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  padding: 18px;
}

.metric-card strong {
  display: block;
  margin-top: 10px;
  font-size: 28px;
  color: var(--accent);
}

.split-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.panel-block {
  padding: 18px;
  border-radius: 18px;
  background: var(--panel-strong);
  border: 1px solid var(--line);
}

.list-table {
  width: 100%;
  border-collapse: collapse;
}

.list-table th,
.list-table td {
  text-align: left;
  padding: 12px 10px;
  border-bottom: 1px solid var(--line);
}

.list-table th {
  color: var(--ink);
}

.field-grid {
  display: grid;
  gap: 14px;
}

.field-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field {
  display: grid;
  gap: 6px;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 11px 12px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
}

.field textarea {
  min-height: 360px;
  resize: vertical;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 13px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.notice {
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff7ef;
  border: 1px solid #eccdb3;
  color: var(--warning);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--line);
}

.goal-list {
  display: grid;
  gap: 12px;
}

.goal-item {
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid var(--line);
}

.progress-summary {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
}

.progress-summary strong {
  color: var(--accent);
}

.progress-track {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: rgba(31, 111, 82, 0.12);
  overflow: hidden;
}

.progress-track.small {
  height: 8px;
  margin-top: 10px;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
}

.progress-fill.next {
  background: linear-gradient(90deg, #9f5226, #d9935f);
}

.progress-fill.done {
  background: linear-gradient(90deg, var(--accent), #4ea57f);
}

.progress-fill.active {
  background: linear-gradient(90deg, var(--accent-2), #e39a6b);
}

.goal-percent {
  margin: 8px 0 0;
}

.goal-chip.done {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}

.goal-chip.active {
  color: #fff;
  background: var(--accent-2);
  border-color: var(--accent-2);
}

.goal-chip.next {
  color: var(--ink);
  background: var(--panel);
}

@media (max-width: 980px) {
  .layout,
  .split-grid,
  .field-grid.two,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    align-items: start;
    flex-direction: column;
  }
}
`;
