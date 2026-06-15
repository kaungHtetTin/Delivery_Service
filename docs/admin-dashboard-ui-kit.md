# Admin Dashboard UI Kit

A portable design and implementation guide for the **FlowDrop office dashboard** look and feel. Use this document to recreate the same operational admin experience in other React (or plain HTML/CSS) applications.

**Source files in this project:**

| File | Role |
| --- | --- |
| `resources/js/styles.css` | All design tokens, admin layout, components |
| `resources/js/portals/AdminPortal.jsx` | Admin shell, pages, tables, drawer, modals |
| `resources/js/components/shared.jsx` | Shared primitives (`Logo`, `StatusBadge`, `ThemeControl`, etc.) |
| `resources/js/icons.jsx` | Inline SVG icon set |
| `resources/js/utils.js` | Helpers (`money`, `useStoredState`) |

---

## 1. Design philosophy

The admin dashboard is built for **daily operations**, not marketing pages.

| Principle | What it means in practice |
| --- | --- |
| Compact density | Small type (11–13px body), tight padding, information-rich tables |
| Glass surfaces | Sidebar, topbar, panels, modals use translucent blur — not the page background |
| One primary action | Each panel has at most one `.btn.primary` in its header |
| Scan-first layout | Metrics → wide queue tables → side summaries |
| Context without navigation | Order detail opens in a right drawer; CRUD opens in modals |
| Semantic color | Brand color is configurable; status colors stay fixed |

---

## 2. Quick start (port to another app)

### 2.1 Minimum HTML shell

```html
<div class="app-root" data-theme="light" style="--color-primary: #087f74">
  <div class="admin-app">
    <aside class="admin-sidebar glass">
      <!-- Logo + nav + profile -->
    </aside>
    <main class="admin-main">
      <header class="admin-topbar glass">
        <!-- search + theme + notifications -->
      </header>
      <div class="admin-content">
        <!-- page content -->
      </div>
    </main>
  </div>
</div>
```

### 2.2 Required CSS imports

1. Google Fonts: `Inter` + `Noto Sans Myanmar`
2. Copy from `styles.css`:
   - `:root` and `.app-root` tokens (lines 3–45)
   - Shared utilities: `.glass`, `.eyebrow`, `.btn`, `.status`, `.form-field`, `.search-box`
   - Admin block (lines 259–385): `.admin-app` through responsive queries

### 2.3 Theme wiring (React)

```jsx
const [theme, setTheme] = useStoredState("app.theme", "light");
const [brand, setBrand] = useStoredState("app.brand", "#087f74");
const themeStyle = { "--color-primary": brand };

return (
  <div className="app-root" data-theme={theme} style={themeStyle}>
    {/* admin shell */}
  </div>
);
```

Dark mode activates when `data-theme="dark"` is set on `.app-root`. Brand color overrides `--color-primary` via inline style.

---

## 3. Design tokens

All colors derive from CSS custom properties on `.app-root`. Components should **never hard-code brand colors**.

### 3.1 Core tokens

| Token | Light default | Purpose |
| --- | --- | --- |
| `--color-primary` | `#087f74` | Brand / links / active nav / primary buttons |
| `--color-primary-dark` | derived via `color-mix` | Primary button hover |
| `--color-primary-soft` | 11% primary tint | Hover backgrounds, icon wells |
| `--color-bg` | `#eef4f4` | Page background |
| `--color-surface` | `#ffffff` | Inputs, solid surfaces |
| `--color-glass` | `rgb(255 255 255 / 78%)` | Panels, sidebar, modals |
| `--color-border` | `rgb(15 23 42 / 10%)` | Borders and dividers |
| `--color-text` | `#172033` | Primary text |
| `--color-muted` | `#69768a` | Secondary text, table headers |
| `--color-soft` | `#f2f6f6` | Segmented control background |
| `--shadow` | soft teal-tinted shadow | Elevation |

Dark mode overrides `--color-bg`, `--color-surface`, `--color-glass`, `--color-border`, `--color-text`, `--color-muted`, `--color-soft`, and `--shadow` when `[data-theme="dark"]` is present.

### 3.2 Page background

The app root uses a neutral base plus two low-contrast radial gradients tinted with the brand color:

```css
background:
  radial-gradient(circle at 7% 4%, color-mix(in srgb, var(--color-primary) 13%, transparent), transparent 23rem),
  radial-gradient(circle at 92% 95%, rgb(86 156 191 / 12%), transparent 27rem),
  var(--color-bg);
```

### 3.3 Fixed semantic status colors

These do **not** change with brand color:

| Class | Text | Background | Use |
| --- | --- | --- | --- |
| `.status-success` | `#168255` | green 10% | completed, paid, available |
| `.status-warning` | `#b77700` | amber 12% | pending, unpaid |
| `.status-danger` | `#ce4444` | red 10% | failed, rejected, cancelled |
| `.status-info` | `#2874bc` | blue 11% | in progress, assigned |
| `.status-neutral` | `#7b8795` | gray 12% | offline, inactive |

### 3.4 Typography

```css
font-family: Inter, "Noto Sans Myanmar", system-ui, sans-serif;
```

| Element | Size | Weight | Notes |
| --- | --- | --- | --- |
| `.eyebrow` | 10px | 700 | Uppercase section label, letter-spacing 1.2px, primary color |
| `h1` (page) | 23–25px | default bold | Page title in `.admin-page-heading` |
| `h2` (panel) | 15–17px | default bold | Panel titles |
| `p`, body | 13px | 400 | Muted color |
| `small` | 11px | 400 | Metadata, table sub-lines |
| `th` | 9px | default | Uppercase, letter-spacing 0.7px |
| `td` | 11px | default | Table cells |
| `.btn` | 12px | 700 | All buttons |

### 3.5 Border radius

| Component | Radius |
| --- | --- |
| Buttons, inputs, badges, icon buttons | `6px` |
| Cards, panels, metric cards | `8px` |
| Modals | `10px` |
| Status pills, filter pills | `99px` (pill) |
| Avatars, notification dots | `50%` |

### 3.6 Spacing scale (de facto)

Based on a 4px grid: `3`, `7`, `8`, `10`, `12`, `14`, `16`, `20` px are the most common values.

| Context | Padding |
| --- | --- |
| Admin content area | `20px` (14px on mobile) |
| Panel | `14px` |
| Metric card | `13px` |
| Sidebar | `15px 11px` |
| Topbar | `0 20px`, height `54px` |
| Modal / drawer footer | `12px 16px` |

---

## 4. Glass surface pattern

Apply the `.glass` class to elevated surfaces:

```css
.glass {
  background: var(--color-glass);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px) saturate(125%);
}
```

**Where to use:** sidebar, topbar, panels, metric cards, drawer, modals, sticky footers.

**Where not to use:** table body rows, dense form fields (use `--color-surface` instead).

**Accessibility fallback:**

```css
@media (prefers-reduced-transparency: reduce) {
  .glass, .drawer-actions { background: var(--color-surface); backdrop-filter: none; }
}
```

---

## 5. App shell layout

### 5.1 Structure

```
┌─────────────────────────────────────────────────────────┐
│ admin-app (CSS grid: 214px | 1fr)                       │
│ ┌──────────┐ ┌────────────────────────────────────────┐ │
│ │ sidebar  │ │ admin-main                             │ │
│ │ (fixed)  │ │ ┌────────────────────────────────────┐ │ │
│ │          │ │ │ admin-topbar (sticky)              │ │ │
│ │ Logo     │ │ └────────────────────────────────────┘ │ │
│ │ Nav      │ │ admin-content                          │ │
│ │ Profile  │ │   page-heading                         │ │
│ └──────────┘ │   metrics-grid / admin-grid / panels   │ │
│              └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                                          ┌──────────────┐
                                          │ drawer (fixed│
                                          │ right, 360px)│
                                          └──────────────┘
```

### 5.2 Key classes

| Class | Layout |
| --- | --- |
| `.admin-app` | `display: grid; grid-template-columns: 214px 1fr; min-height: 100vh` |
| `.admin-sidebar` | Fixed, `width: 214px`, flex column, nav scrolls |
| `.admin-main` | `grid-column: 2`, `min-width: 0` (prevents overflow) |
| `.admin-topbar` | Sticky top, flex, search left, actions right |
| `.admin-content` | Main scrollable page padding |
| `.admin-page-heading` | Flex row: date eyebrow + title vs primary CTA |

### 5.3 Sidebar navigation

```jsx
<nav>
  {nav.map(([value, icon, label]) => (
    <button className={activePage === value ? "active" : ""} type="button">
      <Icon name={icon} size={17} /> {label}
      {/* optional badge: */}<small>{count}</small>
    </button>
  ))}
</nav>
```

- Active and hover: primary text + `--color-primary-soft` background
- Badge (`.admin-sidebar nav small`): red circle, white count, `margin-left: auto`

### 5.4 Profile block

```html
<div class="admin-profile">
  <span>MA</span><!-- initials avatar -->
  <div><strong>May Aye</strong><small>Office admin</small></div>
</div>
```

Pinned to sidebar bottom with `margin-top: auto` and a top border.

---

## 6. Page patterns

### 6.1 Dashboard page

Vertical stack:

1. **`.metrics-grid`** — 5 equal columns (3 on tablet, 2 on mobile)
2. **`.admin-grid`** — 2-column mosaic (`1.65fr 1fr`); use `.wide` for full-span panels

Typical dashboard panels:

| Panel | Class | Content |
| --- | --- | --- |
| Operation addresses | `.panel.wide.glass` | Active pickup/shipping table |
| Live order queue | `.panel.wide.glass` | Compact order table |
| Rider availability | `.panel.glass` | List with avatars + status |
| Live map preview | `.panel.map-panel.glass` | `.admin-map` placeholder |
| Alerts | `.panel.glass` | `.alert-list` rows |

### 6.2 List / CRUD page

Single full-width panel:

```html
<section class="panel glass">
  <div class="panel-heading">
    <div><p class="eyebrow">TEAM MANAGEMENT</p><h2>Riders</h2></div>
    <button class="btn primary">Add rider</button>
  </div>
  <div class="filter-toolbar compact">...</div>
  <div class="table-wrap"><table>...</table></div>
</section>
```

### 6.3 Reports page

```html
<section class="reports-layout">
  <div class="report-metrics"><!-- 3-col metric cards --></div>
  <div class="panel glass"><!-- data table --></div>
</section>
```

### 6.4 Panel heading component

```jsx
function PanelHeading({ eyebrow, title, action }) {
  return (
    <div className="panel-heading">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      {action && <button className="text-btn" type="button">{action}</button>}
    </div>
  );
}
```

---

## 7. Component catalog

### 7.1 Metric card

```html
<article class="metric-card glass">
  <span><!-- icon in top-right well --></span>
  <small>New requests</small>
  <strong>12</strong>
  <p>+2 since 9 AM</p>
</article>
```

- Icon well: 30×30px, `--color-primary-soft` background, top-right absolute
- Value: 23px, tight letter-spacing

### 7.2 Buttons

| Class | Use |
| --- | --- |
| `.btn.primary` | Main action — white text, primary background |
| `.btn.secondary` | Cancel, low emphasis — surface + border |
| `.btn.danger` | Delete, reject — red |
| `.btn.full` | Full width |
| `.grow` | Flex grow (e.g. drawer primary action) |
| `.text-btn` | Text-only link style in panel headers |
| `.icon-btn` | 34×34 icon-only; add `.small` for 27×27 |
| `.icon-btn.danger` | Red destructive icon action |

Min height: 39px (36px in toolbars and compact contexts).

### 7.3 Status badge

```html
<span class="status status-warning">
  <span class="status-dot"></span>
  Pending approval
</span>
```

React helper maps backend status strings to color families automatically (`StatusBadge` in `shared.jsx`).

### 7.4 Search box

```html
<div class="search-box">
  <Icon name="search" size={16} />
  <input placeholder="Search..." />
</div>
```

Used in topbar (`.global-search`), filter toolbars, and modals. Height: 36–39px.

### 7.5 Filter toolbar

```html
<div class="filter-toolbar">
  <div class="search-box">...</div>
  <select>...</select>
  <select>...</select>
  <select>...</select>
</div>
```

Grid: `minmax(240px, 1fr) 155px 155px 155px`. Add `.compact` for 2-column variant.

### 7.6 Data table

```html
<div class="table-wrap">
  <table>
    <thead><tr><th>Order</th>...</tr></thead>
    <tbody>
      <tr><!-- click row to open drawer --></tr>
    </tbody>
  </table>
</div>
```

Conventions:

- Primary line: `<strong>`; secondary: `<small>` below
- Row hover: `--color-primary-soft` background
- Rider cell: `.rider-cell` with circular initials
- Row actions: `.inline-actions` with `.icon-btn.small`
- Empty state: single row, `<span class="muted">` message

### 7.7 Alert list

```html
<div class="alert-list">
  <div>
    <span class="alert-icon warning"><Icon /></span>
    <p><strong>Title</strong><small>Detail - time</small></p>
  </div>
</div>
```

Icon wells: `.alert-icon.warning` (amber) or `.alert-icon.info` (blue).

### 7.8 Route / address block

Used in drawer and mobile views:

```html
<div class="route">
  <span class="route-line"></span>
  <div>
    <span class="route-marker pickup"></span>
    <small>Pickup</small>
    <strong>Address line</strong>
  </div>
  <div>
    <span class="route-marker destination"></span>
    <small>Deliver to</small>
    <strong>Address line</strong>
  </div>
</div>
```

Pickup marker: primary color. Destination marker: `#d17d19` (orange).

### 7.9 Detail rows (drawer sections)

```html
<section>
  <p class="eyebrow">CONTACTS</p>
  <div class="detail-row"><span>Created by</span><strong>Name</strong></div>
</section>
```

Sections separated by top border. Labels muted, values bold.

---

## 8. Overlay patterns

### 8.1 Right drawer (order detail)

```html
<aside class="drawer glass">
  <div class="drawer-header">...</div>
  <!-- scrollable content -->
  <div class="drawer-actions">
    <button class="btn secondary">Edit</button>
    <button class="btn danger">Delete</button>
    <button class="btn primary grow">Assign rider</button>
  </div>
</aside>
```

| Property | Value |
| --- | --- |
| Width | `360px` (94vw max on mobile) |
| Position | Fixed right, full height |
| Scroll | `overflow-y: auto` on drawer |
| Footer | `.drawer-actions` — `position: sticky; bottom: 0` with glass background |

The sticky footer stays at the bottom of the viewport while content scrolls above it — content is never hidden behind buttons.

### 8.2 Modal (CRUD / assignment)

```html
<div class="modal-backdrop">
  <form class="operation-modal glass">
    <div class="drawer-header">...</div>
    <div class="crud-grid">...</div>
    <div class="modal-actions">
      <button class="btn secondary">Cancel</button>
      <button class="btn primary">Save</button>
    </div>
  </form>
</div>
```

| Variant | Class | Max width |
| --- | --- | --- |
| Standard CRUD | `.operation-modal` | 760px |
| Compact CRUD | `.operation-modal.compact` | 590px |
| Assignment | `.assignment-modal` | 530px |

- Backdrop: `rgb(10 19 24 / 35%)`
- Modal actions: absolutely positioned bottom bar (same glass treatment as drawer footer)
- Body scrolls inside modal (`max-height: 90vh; overflow-y: auto`)

### 8.3 CRUD form grid

```html
<div class="crud-grid">
  <label class="form-field">...</label>
  <label class="form-field span-2">...</label>
  <label class="switch-row glass">...</label>
</div>
```

Two columns by default; `.span-2` spans full width. Collapses to one column below 760px.

### 8.4 Form field

```html
<label class="form-field">
  <span>Label</span>
  <input />
</label>
```

- Input height: 43px (36px in compact toolbars)
- Focus: primary border + soft ring (`box-shadow: 0 0 0 3px var(--color-primary-soft)`)

### 8.5 Toggle switch

```html
<label class="switch-row glass">
  <span><strong>Label</strong><small>Description</small></span>
  <input type="checkbox" />
  <i></i><!-- visual switch -->
</label>
```

Hidden checkbox drives the `<i>` pill switch via CSS adjacent-sibling selectors.

---

## 9. Theme control

The topbar includes a palette popover (`ThemeControl`):

- **Theme mode:** segmented control (Light / Dark)
- **Brand color:** preset swatches + native color input
- Popover: `.theme-popover.glass`, positioned below the icon button

Persist theme and brand in `localStorage` (see `useStoredState` in `utils.js`).

---

## 10. Icon system

Icons are inline SVGs via a single React component:

```jsx
<Icon name="grid" size={17} />
```

Available names include: `grid`, `box`, `bike`, `card`, `chart`, `settings`, `search`, `bell`, `plus`, `close`, `check`, `navigation`, `mapPin`, `wallet`, `lock`, `palette`, `sun`, `moon`, and others — see `resources/js/icons.jsx`.

Style: outline strokes, `strokeWidth="1.8"`, `currentColor` — icons inherit text color from context.

To port without React: extract the `<path d="...">` values from `icons.jsx` into SVG snippets or an icon font.

---

## 11. Responsive behavior

| Breakpoint | Changes |
| --- | --- |
| `≤ 1100px` | Metrics grid → 3 columns; admin grid → single column |
| `≤ 760px` | Sidebar collapses to 58px icon rail (labels hidden); profile name hidden; page CTA hidden; filter toolbars stack; drawer uses `min(94vw, 360px)`; CRUD grid single column |

Sidebar collapse technique on mobile:

```css
.admin-sidebar nav button { font-size: 0; } /* hides label text */
.admin-sidebar nav button.active { /* still shows active state via background */ }
```

---

## 12. Z-index stack

| Layer | z-index | Element |
| --- | --- | --- |
| Topbar | 60 | `.admin-topbar` |
| Sidebar | 80 | `.admin-sidebar` |
| Theme popover | 120 | `.theme-popover` |
| Modal backdrop | 130 | `.modal-backdrop` |
| Drawer | 110 | `.drawer` |
| Toast / loading | 140 | `.data-loading`, `.data-error` |

---

## 13. Page inventory (reference)

Current admin navigation and page layout types:

| Nav key | Label | Layout pattern |
| --- | --- | --- |
| `dashboard` | Dashboard | metrics + admin-grid mosaic |
| `orders` | Orders | reports-layout: address board + filtered table |
| `riders` | Riders | single panel + filter toolbar |
| `payments` | Payments | panel + payment-review-grid (table + aside) |
| `cash` | Cash collections | single panel table |
| `users` | Users | single panel table |
| `tracking` | Tracking map | full-map panel with large `.admin-map` |
| `reports` | Reports | report-metrics + table panel |
| `settings` | Settings | single panel table |

Global overlays (not nav pages): order drawer, assignment modal, CRUD modals.

---

## 14. Reuse checklist

When adopting this kit in a new project:

- [ ] Copy `.app-root` tokens and `[data-theme="dark"]` overrides
- [ ] Copy `.glass` and the admin CSS block (§259–385 in `styles.css`)
- [ ] Import Inter + Noto Sans Myanmar fonts
- [ ] Wrap app in `.app-root` with `data-theme` and `--color-primary` style
- [ ] Build shell: `.admin-app` → sidebar + main + topbar
- [ ] Use `.panel.glass` + `.panel-heading` for every content section
- [ ] Use `.table-wrap` > `table` for all data lists
- [ ] Use `.drawer` for detail views, `.operation-modal` for create/edit
- [ ] Use `StatusBadge` pattern for all status columns
- [ ] Keep one `.btn.primary` per panel header
- [ ] Test at 1280px (desktop), 1100px (tablet), and 360px (mobile admin fallback)
- [ ] Verify reduced-transparency and reduced-motion media queries

---

## 15. Customization guide

| Goal | How |
| --- | --- |
| Change brand color | Set `--color-primary` on `.app-root` (runtime or CSS) |
| Add a nav item | Push `[key, iconName, label]` to the nav array; render with the sidebar button pattern |
| Add a new CRUD page | Copy `RidersAdmin` structure: panel + heading + optional filters + table |
| Widen the drawer | Override `.drawer { width: ... }` |
| Remove glass effect | Replace `.glass` with a solid surface class using `--color-surface` |
| Change density | Adjust `td`/`th` padding and `.panel` padding together to stay consistent |

---

## 16. Related documentation

- `docs/ui-ux-specification.md` — full product UX spec (client, rider, and admin requirements)
- `docs/architecture.md` — application structure and API overview

This UI kit document focuses on **what is implemented today** in the office dashboard and how to replicate it elsewhere.
