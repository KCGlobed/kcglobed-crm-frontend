# reporting-tree

Drop-in, self-contained folder for rendering your reporting hierarchy as a
top-down org chart — rounded rectangle root, circular icon nodes below,
elbow connector lines branching down (matches the reference design).

## Files
- `types.ts` — `ReportingTreeNode` / `ReportingTreeResponse` interfaces
- `roleIcons.tsx` — small line-icon set, auto-picked by role name
  (Super Admin, Admin, Sales, Director; anything else falls back to a
  generic user icon)
- `ReportingTreeNode.tsx` — recursive node (rectangle at depth 0, circle
  everywhere else), click a circle with reports to collapse/expand it
- `ReportingTree.tsx` — exports `ReportingTree` (presentational) and
  `ConnectedReportingTree` (fetches for you). Renders one tree per
  top-level array entry, since your API can return multiple independent
  roots that don't share a parent.
- `useReportingTree.ts` — fetch/loading/error/refetch hook
- `reportingTree.css` — the connector-line technique + all styling
- `index.ts` — barrel export

## Install
Copy the whole `reporting-tree/` folder into your project (e.g.
`src/components/reporting-tree/`). No extra npm packages — pure React + CSS.

## Usage

### Option A — you already have a function that calls your API
```tsx
import { ConnectedReportingTree } from "./components/reporting-tree";
import { api } from "../lib/api";

<ConnectedReportingTree
  fetcher={() => api.get("/reporting-tree").then((r) => r.data)}
/>
```

### Option B — you manage fetching/state yourself
```tsx
import { ReportingTree } from "./components/reporting-tree";

<ReportingTree data={treeData} isLoading={loading} error={error} />
```

### Customizing
- Colors: override the CSS variables at the top of `reportingTree.css`
  (`--rt-primary`, `--rt-primary-dark`, `--rt-line`, etc.)
- Icons per role: pass `roleIconOverrides={{ "Team Lead": <MyIcon /> }}` —
  matched case-insensitively against `node.role`
- The small badge on each circle shows `team_count` and doubles as the
  expand/collapse control; click a circle with reports to fold its branch

New fields your backend adds to a node won't break anything (`types.ts`
has an index signature for that) but won't render automatically — add
them to the interface and to `ReportingTreeNode.tsx` when you want them shown.
