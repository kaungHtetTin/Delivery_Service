# Delivery Service Management System UI/UX Specification

## 1. Purpose

This document defines the user interface and user experience requirements for the delivery service management system.

The system has three primary interfaces:

1. Client Portal: mobile-first web application / PWA
2. Rider Portal: mobile-first PWA
3. Office Admin Dashboard: desktop-first web dashboard

The visual goal is a compact, professional operations product. The interface should feel modern without becoming decorative or oversized. Components may use a subtle glass-like blur effect, but clarity, speed, and readability must remain the priority.

---

## 2. Design Principles

### 2.1 Professional and Operational

The interface should feel suitable for daily business operations:

* Clear hierarchy
* Compact layouts
* Predictable controls
* Fast access to frequent actions
* Strong visual distinction between normal, warning, and critical states

### 2.2 Mobile-First for Client and Rider

Client and rider interfaces must work comfortably on a phone before tablet or desktop layouts are considered.

* Primary actions should be reachable with one hand.
* Touch targets must be at least `44 x 44 px`.
* Important actions should remain visible near the bottom of the screen when appropriate.
* Forms should use a single-column layout on mobile.
* Long processes should be divided into short, understandable steps.

### 2.3 Dense and Compact

Avoid large empty spaces, oversized cards, and excessive padding.

* Use a compact spacing scale.
* Keep information-rich admin pages scannable.
* Use tables, list rows, tabs, and grouped fields where they improve efficiency.
* Do not compress touch interfaces so tightly that they become difficult to use.

### 2.4 Controlled Glass Effect

Use glass-like surfaces as a visual layer, not as a novelty.

* Apply blur to app bars, sidebars, floating panels, modal dialogs, filter bars, and selected summary cards.
* Keep main content surfaces readable with sufficient opacity.
* Avoid stacking multiple translucent layers over each other.
* Provide a solid-color fallback when blur is unsupported or reduced-transparency mode is enabled.

### 2.5 Theme Flexibility

The system must support dynamic theme color changes without redesigning individual screens.

* The primary brand color must be configurable.
* Light, dark, and system modes must be supported.
* Status colors must remain semantically fixed and must not become indistinguishable when the brand color changes.
* Theme changes should apply immediately and persist for the user.

---

## 3. Responsive Layout Strategy

### 3.1 Breakpoints

| Name | Width | Primary Use |
| --- | --- | --- |
| Mobile | `< 640 px` | Client and rider default layout |
| Tablet | `640-1023 px` | Expanded client and rider layout, compact admin fallback |
| Desktop | `1024-1439 px` | Admin dashboard default |
| Large desktop | `>= 1440 px` | Admin dashboard with wider data panels |

### 3.2 Client and Rider Layout

* Default to one content column.
* Use a maximum content width of `720 px` on larger screens.
* Use a sticky top app bar where page context is needed.
* Use a bottom navigation bar for the most frequent destinations.
* Use sticky bottom action areas for critical workflow actions.

### 3.3 Admin Layout

* Default to a left sidebar, top toolbar, and scrollable content area.
* Support sidebar collapse on desktop.
* Use dense grids and tables for operational pages.
* Use split-panel layouts for order details, assignment, and payment review.
* On tablet, collapse the sidebar and allow tables to scroll horizontally.

---

## 4. Visual Design System

## 4.1 Design Tokens

The UI should be implemented using reusable design tokens. Hard-coded theme colors should be avoided inside page components.

### Color Tokens

| Token | Purpose |
| --- | --- |
| `--color-primary` | Configurable brand color |
| `--color-primary-hover` | Hover state derived from brand color |
| `--color-primary-soft` | Low-emphasis tinted background |
| `--color-accent` | Optional complementary accent |
| `--color-bg` | Main application background |
| `--color-surface` | Standard content surface |
| `--color-surface-elevated` | Raised surface and modal background |
| `--color-glass` | Translucent glass surface |
| `--color-border` | Standard border |
| `--color-text` | Primary text |
| `--color-text-muted` | Secondary text |
| `--color-success` | Completed, paid, available |
| `--color-warning` | Pending, attention required |
| `--color-danger` | Failed, rejected, destructive action |
| `--color-info` | Informational or in-progress state |

Recommended default primary color: deep blue or blue-teal. Avoid overly bright brand colors for large surfaces.

### Theme Modes

| Mode | Behavior |
| --- | --- |
| Light | Light neutral background with translucent white surfaces |
| Dark | Deep slate background with translucent dark surfaces |
| System | Automatically follows the operating system preference |

### Dynamic Theme Configuration

Super admin should be able to configure:

* Primary brand color
* Optional accent color
* Default theme mode
* Logo
* Application name

Individual users should be able to choose:

* Light mode
* Dark mode
* System mode

Theme configuration should be stored centrally and delivered to all portals. User mode preference should override the system default.

## 4.2 Glass Surface Style

Recommended glass panel properties:

```css
background: color-mix(in srgb, var(--color-surface) 78%, transparent);
border: 1px solid var(--color-border);
backdrop-filter: blur(14px) saturate(125%);
box-shadow: 0 8px 24px rgb(15 23 42 / 8%);
```

Rules:

* Use `10-16 px` blur for most surfaces.
* Use subtle shadows with low opacity.
* Use visible borders to define translucent surfaces.
* Keep body background simple: a neutral base with one or two low-contrast color gradients.
* Do not use blur behind dense table cells. Use a stable surface for readability.

## 4.3 Border Radius

The UI must not appear excessively rounded.

| Component | Radius |
| --- | --- |
| Inputs, buttons, badges | `6 px` |
| Cards, panels, dropdowns | `8 px` |
| Modals and drawers | `10 px` |
| Circular controls, avatars | `999 px` only where naturally circular |

Avoid pill-shaped buttons except for status filters, compact tags, and segmented controls.

## 4.4 Spacing Scale

Use a compact `4 px` base grid.

| Token | Value | Typical Use |
| --- | --- | --- |
| `space-1` | `4 px` | Icon gaps, tight internal spacing |
| `space-2` | `8 px` | Input groups, compact row padding |
| `space-3` | `12 px` | Standard component padding |
| `space-4` | `16 px` | Section padding on mobile |
| `space-5` | `20 px` | Larger content groups |
| `space-6` | `24 px` | Page section separation |
| `space-8` | `32 px` | Major page separation only |

Guidelines:

* Mobile page padding: `16 px`
* Admin content padding: `16-24 px`
* Compact admin table row height: `44-52 px`
* Standard input height: `42-44 px`
* Compact desktop input height: `36-40 px`

## 4.5 Typography

Use a clean sans-serif font with good Myanmar and Latin character support.

Recommended font stack:

```css
font-family: Inter, "Noto Sans Myanmar", system-ui, sans-serif;
```

| Style | Size | Weight | Use |
| --- | --- | --- | --- |
| Page title | `22-26 px` | `700` | Main screen heading |
| Section title | `16-18 px` | `600-700` | Card and section headings |
| Body | `14 px` | `400-500` | Default interface text |
| Compact body | `13 px` | `400-500` | Admin tables and metadata |
| Caption | `12 px` | `400-500` | Secondary metadata |
| Button | `13-14 px` | `600` | Action controls |

Use tabular numerals for currency, order numbers, and operational metrics.

## 4.6 Icons

* Use a consistent outline icon library.
* Use filled icons only for selected navigation items or high-priority alerts.
* Pair unfamiliar icons with text.
* Do not rely on icon color alone to communicate state.

---

## 5. Shared Components

## 5.1 App Shell

### Mobile App Shell

* Compact top app bar with page title and contextual actions
* Scrollable content area
* Bottom navigation with `3-5` destinations
* Optional sticky bottom action bar

### Admin App Shell

* Collapsible left sidebar
* Top toolbar with search, alerts, theme switcher, and profile menu
* Main content area with breadcrumb and page title where useful
* Optional right-side detail drawer

## 5.2 Buttons

| Variant | Use |
| --- | --- |
| Primary | Main action for the current context |
| Secondary | Important supporting action |
| Ghost | Low-emphasis toolbar action |
| Danger | Cancel, reject, delete, or fail action |
| Icon button | Compact utility action with tooltip |

Rules:

* Show one dominant primary action per panel.
* Disable actions during submission and show progress feedback.
* Require confirmation for destructive actions.

## 5.3 Forms

* Place labels above inputs.
* Show required fields clearly.
* Use helper text only when it adds value.
* Validate inline after interaction and again on submission.
* Preserve entered information when a submission error occurs.
* Use numeric keyboard modes for phone numbers and money fields on mobile.
* Provide GPS capture buttons next to address fields.
* Show upload progress and a thumbnail for image uploads.

## 5.4 Status Badge

Use compact badges with a colored dot, readable label, and lightly tinted background.

| Status Family | Visual Treatment |
| --- | --- |
| Pending / approval required | Amber |
| Assigned / in progress | Blue |
| Available / paid / completed | Green |
| Failed / rejected / cancelled | Red |
| Offline / inactive | Neutral gray |
| On break / paused | Violet or muted amber |

## 5.5 Timeline

Use a vertical timeline on mobile and an optional horizontal timeline on wider screens.

Each event should show:

* Status label
* Timestamp
* Actor when relevant
* Optional note
* Current status emphasis

## 5.6 Empty, Loading, and Error States

Each data area must define:

* Skeleton loading state
* Empty state with a short explanation
* Error state with retry action
* Offline state for rider PWA
* Permission-denied state for GPS and notifications

---

## 6. Client Portal

## 6.1 Navigation

Recommended mobile bottom navigation:

1. Home
2. My Deliveries
3. New Request
4. Notifications
5. Account

`New Request` may receive stronger visual emphasis because it is the main client action.

## 6.2 Client Home

Purpose: help the client create a delivery request quickly and see current activity.

Layout:

* Greeting and notification icon
* Primary `Create Delivery Request` action
* Active delivery summary card
* Recent deliveries list
* Saved pickup locations shortcut
* Support contact shortcut

Mobile behavior:

* Show the active delivery first when one exists.
* Keep the primary request action visible without scrolling.
* Use compact list rows rather than large cards for history.

## 6.3 New Delivery Request

Use a step-based mobile form to avoid one very long page.

### Step 1: Pickup

Fields:

* Pickup shop name
* Contact person
* Phone number
* Address
* GPS location capture
* Pickup note

Actions:

* Use current location
* Choose saved location
* Continue

### Step 2: Delivery

Fields:

* Receiver name
* Receiver phone number
* Receiver address
* Receiver GPS location
* Delivery note

### Step 3: Product

Fields:

* Product name
* Category
* Quantity
* Product value
* Optional photo
* Fragile item toggle
* Special handling note

### Step 4: Payment

Fields:

* Delivery fee payment method
* Product payment method
* Cash-on-delivery amount
* Prepaid amount
* Mobile banking screenshot upload when applicable

### Step 5: Review and Submit

Show:

* Pickup summary
* Delivery summary
* Product summary
* Payment summary
* Estimated or entered delivery fee
* Edit links for each section
* Final submit action

UX rules:

* Save draft progress locally until submission.
* Show step number and progress.
* Keep `Back` and `Continue` actions sticky at the bottom.
* Warn the user before leaving a partially completed request.

## 6.4 Delivery Tracking

Header:

* Order code
* Current status badge
* Created date and time

Main content:

* Current status message
* Rider card after assignment: name, phone action, vehicle details
* Pickup and delivery summary
* Timeline of status updates
* Payment summary
* Map preview when tracking is enabled
* Support contact action

Use plain-language client statuses. Internal admin statuses may be grouped into simpler public labels.

Example:

| Internal Status | Client Label |
| --- | --- |
| `pending`, `approved` | Waiting for office approval |
| `rider_assigned`, `rider_accepted` | Rider assigned |
| `going_to_pickup`, `arrived_at_pickup` | Rider going to pickup |
| `picked_up`, `going_to_delivery`, `arrived_at_delivery` | Product on the way |
| `delivered`, `completed` | Delivered |

## 6.5 Delivery History

* Search by order code
* Filter by active, completed, cancelled
* Show order code, route summary, date, amount, and status
* Open tracking details on row tap

## 6.6 Client Account

* Personal information
* Saved locations
* Notification settings
* Theme mode
* Language preference when localization is implemented
* Logout

---

## 7. Rider Portal

## 7.1 Rider UX Priorities

The rider portal must be fast to use while moving between stops.

* Make the next required action obvious.
* Minimize typing.
* Show pickup, delivery, and money information clearly.
* Keep GPS and network state visible.
* Prevent accidental status changes with confirmation where the action is difficult to reverse.
* Support graceful recovery after temporary network loss.

## 7.2 Navigation

Recommended mobile bottom navigation:

1. Jobs
2. History
3. GPS Status
4. Notifications
5. Account

## 7.3 Rider Home / Jobs

Header:

* Rider availability toggle
* GPS connection indicator
* Notification icon

Content:

* Current active assignment first
* New assignment requests
* Upcoming jobs
* Daily collection summary

Assignment card content:

* Order code
* Current status
* Pickup area and delivery area
* Distance to pickup when available
* COD amount
* Time assigned
* Main action

## 7.4 Assignment Detail

Sections:

* Order status and code
* Pickup details with call and navigation actions
* Delivery details with call and navigation actions
* Product details and fragile warning
* Payment and COD details
* Notes
* Status timeline

Sticky bottom action area:

* Show the next valid workflow action.
* Use a secondary menu for exception actions.

Workflow action examples:

| Current Status | Main Action |
| --- | --- |
| Rider assigned | Accept assignment |
| Rider accepted | Start going to pickup |
| Going to pickup | Arrived at pickup |
| Arrived at pickup | Confirm product pickup |
| Picked up | Start delivery |
| Going to delivery | Arrived at delivery |
| Arrived at delivery | Confirm delivered |
| Delivered | Record cash and complete |

## 7.5 Reject or Request Reassignment

Use a bottom sheet with:

* Reason selection
* Optional note
* Confirmation action

Reason options:

* Vehicle issue
* Emergency
* Wrong assignment
* Too far from pickup
* Rider unavailable
* Other

## 7.6 COD Collection

Show:

* Product cash expected
* Delivery fee expected
* Total expected
* Product cash collected input
* Delivery fee collected input
* Total collected calculated automatically
* Difference warning if amounts do not match
* Payment note
* Confirmation checkbox or action

The rider must confirm collection before completing an order that requires COD.

## 7.7 GPS Status

Show:

* GPS permission status
* Current online/offline state
* Last location update time
* Tracking activity
* Battery-saving explanation
* Retry or open-settings action when permission is missing

Use a persistent but unobtrusive banner if required tracking is disabled during an active assignment.

## 7.8 Offline Handling

* Cache the current assignment details.
* Clearly show offline mode.
* Queue permitted status updates locally.
* Sync queued updates when the network returns.
* Show sync state and any failed update that needs rider attention.

---

## 8. Office Admin Dashboard

## 8.1 Admin UX Priorities

The office dashboard is an operational workspace. It should favor scan speed, clear exception handling, and efficient use of a larger screen.

* Use compact tables and panels.
* Keep important filters visible.
* Allow common workflows without unnecessary page changes.
* Highlight pending work and overdue activity.
* Use drawers and modal dialogs for quick actions.

## 8.2 Sidebar Navigation

Recommended items:

1. Dashboard
2. Orders
3. Riders
4. Payments
5. Cash Collections
6. Tracking Map
7. Reports
8. Customers and Shops
9. Notifications
10. Settings
11. Admin Logs

Group less frequent super-admin items under `Settings`.

## 8.3 Dashboard Overview

Top metric row:

* New requests
* Active deliveries
* Available riders
* Pending payment approvals
* Today's income

Secondary content:

* Live order queue
* Rider availability summary
* Pending mobile banking approvals
* Cash collection summary
* Compact live map preview
* Recent alerts and rider switch requests

Desktop grid:

* Use a `12-column` layout.
* Keep high-priority queue content wider than summary panels.
* Avoid a wall of equal-sized cards.
* Use compact metric cards with one value, label, and small context indicator.

## 8.4 Real-Time New Order Alert

When a new request arrives:

* Show a toast and notification sound.
* Update the new-order count immediately.
* Insert the request into the live queue.
* Allow the admin to open a compact order preview.
* Provide `Review`, `Approve`, `Reject`, and `Assign Rider` actions as appropriate.

Allow notification sound to be enabled or disabled in user preferences.

## 8.5 Orders Page

Toolbar:

* Search by order code, phone number, or receiver name
* Status filter
* Rider filter
* Client or shop filter
* Date range
* More filters
* Export action when reporting is implemented

Table columns:

* Order code
* Created time
* Client or shop
* Pickup
* Delivery
* Rider
* Payment
* COD amount
* Status
* Updated time
* Actions

Behavior:

* Use sticky table headers.
* Allow sorting where useful.
* Preserve filter state when returning from an order.
* Open quick details in a right-side drawer.
* Open the full order detail page for deeper work.

## 8.6 Order Detail

Header:

* Order code
* Status badge
* Created time
* Primary action based on current state
* More actions menu

Main layout:

* Left area: status timeline and route details
* Center or primary area: pickup, delivery, product, and payment information
* Right area: rider assignment, internal notes, and activity history

Admin actions:

* Approve or reject request
* Assign or change rider
* Edit order
* Add internal note
* Review payment
* Cancel order
* Mark failed delivery

## 8.7 Rider Assignment

Use a drawer or modal panel.

Content:

* Order pickup summary
* Search rider
* Availability filter
* Rider list with availability, distance, active orders, area, and last GPS update
* Recommended rider rank when recommendation logic is available
* Assignment note
* Confirm action

For the MVP, manual assignment should remain fully usable even when GPS data is unavailable.

## 8.8 Riders Page

Toolbar:

* Search rider
* Availability filter
* Area filter
* Last-active filter

Table columns:

* Rider
* Phone
* Status
* Active orders
* Last GPS update
* Current area
* Cash held
* Rating when implemented
* Actions

Include list and map view switching when map tracking is implemented.

## 8.9 Tracking Map

Desktop layout:

* Large map area
* Left filter panel
* Right rider or order detail panel on selection

Map controls:

* Rider status filter
* Delivery status filter
* Search rider or order
* Auto-refresh indicator
* Last-updated timestamp
* Pickup and delivery pin visibility toggle

Map marker rules:

* Use distinct marker types for riders, pickups, and delivery destinations.
* Show rider status through marker color and label.
* Cluster markers at low zoom levels.

## 8.10 Payment Approval

Use a queue layout with a review panel.

Queue columns:

* Payment reference
* Order code
* Client
* Amount
* Payment type
* Submitted time
* Status

Review panel:

* Screenshot preview with zoom
* Order payment summary
* Submitted amount
* Admin note
* Approve action
* Reject action with required reason
* Audit history

## 8.11 Reports

Initial reports:

* Daily orders
* Monthly orders
* Rider performance
* Cash collections
* Mobile banking approvals
* Failed deliveries
* Client and shop activity
* Income

Report UX:

* Date range filter
* Relevant entity filters
* Summary metrics
* Compact chart only where it improves interpretation
* Data table
* Export action

---

## 9. Notifications and Alerts

## 9.1 Priority Levels

| Level | Examples | Treatment |
| --- | --- | --- |
| Informational | Order approved, rider assigned | Standard toast and notification entry |
| Attention | Payment review pending, GPS stale | Amber highlight |
| Critical | Rider transfer request, failed delivery | Persistent red alert until acknowledged |

## 9.2 Notification Center

Each portal should provide:

* Unread count
* Read and unread state
* Timestamp
* Related order link
* Mark as read
* Mark all as read

Admin notifications should support filtering by priority and type.

---

## 10. Accessibility and Usability

Minimum requirements:

* Meet WCAG AA contrast targets for text and interactive controls.
* Ensure keyboard navigation for the admin dashboard.
* Show visible focus states.
* Do not rely on color alone for status communication.
* Add text labels or tooltips to icon-only controls.
* Respect reduced-motion preferences.
* Provide a reduced-transparency fallback for glass effects.
* Use readable date, time, and MMK currency formatting.
* Support Myanmar and English text rendering even if localization is phased in later.

---

## 11. Motion and Feedback

Use subtle motion only where it improves comprehension.

* Toast entry and exit: `150-220 ms`
* Drawer and modal transition: `180-240 ms`
* Button state change: `120-180 ms`
* Skeleton loading shimmer: subtle and disabled under reduced-motion settings

Avoid decorative animation on operational screens.

Every user action should provide clear feedback:

* Loading indicator during network requests
* Success toast after completion
* Inline error with recovery guidance
* Confirmation before destructive actions
* Updated status visible immediately after successful workflow changes

---

## 12. Implementation Guidance

### 12.1 Component Architecture

Create reusable components for:

* App shell
* Mobile bottom navigation
* Sidebar
* Top toolbar
* Glass panel
* Metric card
* Status badge
* Order list row
* Data table
* Filter toolbar
* Timeline
* Empty state
* Loading skeleton
* Modal
* Drawer
* Bottom sheet
* Toast
* Confirm dialog
* GPS status indicator
* File upload preview

### 12.2 Theme Implementation

Use CSS custom properties at the application root. Theme mode and brand configuration should be applied using root-level attributes or classes.

Example:

```html
<html data-theme="dark" data-brand="custom">
```

```css
:root {
  --color-primary: #0f6f73;
  --color-bg: #f4f7f8;
  --color-surface: #ffffff;
  --color-glass: rgb(255 255 255 / 78%);
  --color-border: rgb(15 23 42 / 12%);
  --color-text: #172033;
  --color-text-muted: #647084;
}

[data-theme="dark"] {
  --color-bg: #101722;
  --color-surface: #172131;
  --color-glass: rgb(23 33 49 / 78%);
  --color-border: rgb(226 232 240 / 14%);
  --color-text: #edf2f7;
  --color-text-muted: #aab6c7;
}
```

Use derived shades for hover, focus, and soft backgrounds. Validate contrast whenever a custom brand color is saved.

### 12.3 Performance

* Keep blurred surfaces limited to avoid poor performance on lower-end mobile devices.
* Load maps only on screens where they are required.
* Use list virtualization for large admin tables when necessary.
* Compress uploaded screenshots and product images where appropriate.
* Use skeleton states to improve perceived performance.

---

## 13. MVP UI Delivery Order

Build the UI in this order:

1. Shared theme tokens and reusable components
2. Client request submission and client tracking view
3. Admin shell, dashboard, order queue, and order detail
4. Manual rider assignment
5. Rider shell, jobs view, assignment detail, and status update workflow
6. COD collection
7. Mobile banking screenshot upload and admin approval queue
8. Basic notifications
9. Basic GPS status and location reporting
10. Reports
11. Map visualization and rider recommendation enhancements

---

## 14. UI Acceptance Criteria

The MVP UI is acceptable when:

* Client and rider workflows are comfortable to use at `360 px` viewport width.
* Admin pages are efficient and readable at `1280 px` viewport width.
* Main surfaces use a restrained glass-like treatment with readable fallbacks.
* Cards, inputs, and panels use modest corner radii.
* Page spacing is compact and consistent.
* Light, dark, and system theme modes work across all portals.
* Changing the configured primary color updates the entire UI consistently.
* All order, rider, and payment statuses have clear semantic treatments.
* Forms provide inline validation and preserve user input on errors.
* GPS permission, offline, loading, empty, and error states are handled.
* Admin workflows support keyboard navigation and visible focus states.
* Mobile primary actions remain easy to reach.

