# Android Rider UI/UX Specification

This document defines the native Android rider app UI and UX. The goal is to match the current rider webapp as closely as possible while implementing it with Android Java and XML.

Use this together with:

- `docs/android-rider-api.md`
- `resources/js/portals/RiderPortal.jsx`
- `resources/js/components/shared.jsx`
- `resources/js/styles.css`

## Product Goal

The Android rider app is a native version of the current rider web portal. It must feel like the same product:

- Same mobile shell
- Same bottom tabs
- Same rider job cards
- Same workflow copy
- Same GPS status screen
- Same notification list
- Same account layout
- Same colors, spacing, rounded corners, and "glass" surface style

The Android app should not become a different dashboard. It should be a native implementation of the web rider UI.

## Design System

### Visual Personality

The rider app should feel:

- Compact
- Operational
- Mobile-first
- Calm and work-focused
- Light, clean, and slightly glassy
- Fast to scan while riding or stopping briefly

Avoid:

- Marketing hero layouts
- Large decorative illustrations
- Heavy gradients
- Large card nesting
- Oversized typography
- Extra explanatory text not present in the web app

### Font

Web app font:

```text
Inter, Noto Sans Myanmar, system-ui, sans-serif
```

Android recommendation:

- Primary: bundled Inter if possible
- Myanmar fallback: Noto Sans Myanmar
- Fallback: system sans

Suggested Android assets:

```text
res/font/inter_regular.ttf
res/font/inter_medium.ttf
res/font/inter_semibold.ttf
res/font/inter_bold.ttf
res/font/noto_sans_myanmar_regular.ttf
res/font/noto_sans_myanmar_medium.ttf
```

Default text should use Inter. Any Myanmar text should render with Noto Sans Myanmar fallback.

### Light Theme Tokens

Use these as Android color resources.

```xml
<color name="fd_primary">#087F74</color>
<color name="fd_primary_dark">#06675F</color>
<color name="fd_primary_soft">#1C087F74</color>
<color name="fd_bg">#EEF4F4</color>
<color name="fd_surface">#FFFFFF</color>
<color name="fd_glass">#C7FFFFFF</color>
<color name="fd_border">#1A0F172A</color>
<color name="fd_text">#172033</color>
<color name="fd_muted">#69768A</color>
<color name="fd_soft">#F2F6F6</color>
<color name="fd_success">#168255</color>
<color name="fd_danger">#CE4444</color>
<color name="fd_warning">#B77700</color>
<color name="fd_warning_dark">#9A5700</color>
<color name="fd_info">#2874BC</color>
<color name="fd_neutral">#7B8795</color>
<color name="fd_red_badge">#E45151</color>
<color name="fd_cod_bg">#29DE9600</color>
<color name="fd_gps_green">#19A86B</color>
<color name="fd_destination">#D17D19</color>
```

### Dark Theme Tokens

The web app has a dark mode. Android should support the same mode if feasible.

```xml
<color name="fd_dark_bg">#101921</color>
<color name="fd_dark_surface">#17232D</color>
<color name="fd_dark_glass">#C716222C</color>
<color name="fd_dark_border">#1FDEEFF1</color>
<color name="fd_dark_text">#ECF5F5</color>
<color name="fd_dark_muted">#A7B5C0</color>
<color name="fd_dark_soft">#202F39</color>
```

### Background

Web uses a soft background with faint radial color fields. Native Android should approximate it:

- Root background: `#EEF4F4`
- Add a subtle top-left primary tint if possible
- Add a subtle bottom-right pale blue tint if possible
- If this is too expensive in XML, use plain `#EEF4F4`

Suggested native implementation:

- Use a root `FrameLayout`
- Background color `fd_bg`
- Optional custom drawable with very soft radial gradients

Do not use strong gradients or decorative blobs.

### Glass Surface

The web `.glass` style:

```css
background: rgb(255 255 255 / 78%);
border: 1px solid rgb(15 23 42 / 10%);
box-shadow: 0 10px 25px rgb(30 61 67 / 8%);
backdrop-filter: blur(14px) saturate(125%);
```

Android approximation:

- Background: `fd_glass`
- Border: `fd_border`, 1dp
- Corner radius: usually 8dp
- Elevation: 2dp to 4dp
- Do not overuse blur; normal Android blur is not required

Reusable drawable:

```xml
res/drawable/bg_glass.xml
```

```xml
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@color/fd_glass" />
    <stroke android:width="1dp" android:color="@color/fd_border" />
    <corners android:radius="8dp" />
</shape>
```

### Radius

Match the web app's tight radius.

| Element | Radius |
| --- | --- |
| App icon mark | 8dp |
| Cards | 8dp |
| Small buttons | 6dp |
| Inputs | 6dp |
| Status pills | 99dp |
| Toggle track | 30dp |
| Modal sheet | 10dp |
| Avatar | Circle |

Avoid large rounded 20dp cards. The current app uses compact 6 to 10dp radii.

### Elevation

Use modest elevation.

| Element | Elevation |
| --- | --- |
| Topbar | 3dp |
| Bottom nav | 4dp |
| Cards | 2dp |
| Modal | 8dp |
| Map overlay | 4dp |

### Typography

Use sp values close to the web CSS.

| Web concept | Android style | Size | Weight |
| --- | --- | --- | --- |
| Screen H1 | `TextAppearance.FD.H1` | 25sp | 600 or 700 |
| Rider hero H1 | `TextAppearance.FD.HeroTitle` | 23sp | 600 or 700 |
| Section H2 | `TextAppearance.FD.H2` | 17sp | 600 |
| Card H3 | `TextAppearance.FD.H3` | 15sp | 600 |
| Body | `TextAppearance.FD.Body` | 13sp | 400 |
| Small | `TextAppearance.FD.Small` | 11sp | 400 or 600 |
| Eyebrow | `TextAppearance.FD.Eyebrow` | 10sp | 700 |
| Status badge | `TextAppearance.FD.Badge` | 10sp | 700 |
| Nav label | `TextAppearance.FD.NavLabel` | 9sp | 700 |
| Input | `TextAppearance.FD.Input` | 13sp | 400 |
| Fee input | `TextAppearance.FD.FeeInput` | 24sp | 700 |

Letter spacing:

- Eyebrow: about 0.08em to 0.12em
- Other text: 0
- Do not use negative letter spacing in Android

### Buttons

Base button:

- Min height: 39dp
- Horizontal padding: 13dp
- Radius: 6dp
- Text size: 12sp
- Weight: 700
- Icon gap: 7dp

Primary:

- Background: `fd_primary`
- Text: white

Secondary:

- Background: `fd_surface`
- Border: `fd_border`
- Text: `fd_text`

Danger:

- Background: `#C53F3F`
- Text: white

Disabled:

- Opacity: 55 percent
- Not clickable

### Icons

The web app uses custom line icons with 1.8 stroke. Android should use equivalent vector drawables.

Required icons:

| Name | Use |
| --- | --- |
| navigation | logo, GPS, map actions |
| box | jobs tab, jobs placeholder |
| clock | history, last sent |
| location | GPS tab and status |
| bell | notifications |
| user | account |
| refresh | refresh button |
| moon | light to dark toggle |
| sun | dark to light toggle |
| phone | call buttons |
| chevronLeft | back button |
| chevronRight | history detail link |
| arrowRight | next action |
| close | close modal, stop duty |
| check | confirm modal actions |
| wallet | delivery fee and COD |
| lock | privacy note and logout |
| upload | offline queue |
| filter | accuracy row |
| bike | rider status |
| mapPin | GPS unavailable |
| more | issue button |

Use 18dp as default icon size. Use 15 to 17dp for inline buttons and compact rows.

## Global App Shell

All rider screens share the same shell.

### Screen Width

Web app caps mobile app at 500px and centers it.

Android native should fill the device width. On tablets, cap the content width to approximately 500dp and center it.

Rules:

- Phone: full width
- Tablet: max content width 500dp
- Root minimum width: 320dp

### Topbar

Topbar height: 57dp.

Position:

- Fixed at top in web
- Android: normal top app bar pinned at top

Layout:

```text
[Logo mark + app name + DELIVERY]        [Socket badge] [Refresh] [Theme] [Bell]
```

Dimensions:

- Height: 57dp
- Horizontal padding: 15dp
- Vertical padding: 11dp
- Bottom border: 1dp
- Background: glass
- Elevation: 3dp

Logo:

- Mark: 32dp x 32dp
- Radius: 8dp
- Background: primary
- If app icon exists, image fills mark
- If no icon, show navigation icon in white
- Text:
  - App name: 15sp, bold
  - DELIVERY: 8sp, primary, bold, letter spaced

Topbar buttons:

- Size: 34dp x 34dp
- Transparent background
- Radius: 6dp
- Icon color: muted
- Pressed/hover equivalent: primary soft background, primary icon

Socket badge:

- Height: 28dp
- Padding horizontal: 9dp
- Radius: pill
- Font: 10sp, weight 800
- Connected:
  - Text: "Socket"
  - Color: success
  - Background: success at 10 percent
  - Dot: 7dp
- Disconnected:
  - Text: "Socket"
  - Color: danger
  - Background: danger at 10 percent
  - Dot: 7dp

Notification badge:

- Red circle/pill
- Min width: 17dp
- Height: 17dp
- Top-right over bell
- Font: 9sp, weight 900
- If count > 99, display `99+`

### Main Content

Web:

```css
padding: 0 15px 78px;
min-height: calc(100vh - 57px);
```

Android:

- Use `NestedScrollView` or `RecyclerView`
- Horizontal padding: 15dp
- Top content starts under topbar
- Bottom padding: at least 78dp so content does not hide behind bottom nav

### Bottom Navigation

Bottom nav height: minimum 62dp.

Position:

- Fixed bottom in web
- Android: bottom anchored navigation bar

Grid:

```text
Jobs | History | GPS | Alerts | Account
```

Each item:

- Equal width
- Padding top: 9dp
- Padding bottom: 7dp
- Icon: 18dp
- Label: 9sp, weight 700
- Inactive color: muted
- Active color: primary

Badges:

- Jobs: active jobs count
- Alerts: unread notifications count
- Badge min width: 16dp
- Badge height: 16dp
- Font: 8sp, weight 900
- Color: white
- Background: red `#E45151`

Do not use Material bottom navigation styling if it changes the look too much. It should look like the web `.mobile-nav glass`.

## Reusable Components

### Status Badge

Shape:

- Pill radius
- Padding: 4dp vertical, 7dp horizontal
- Gap: 5dp
- Dot: 6dp
- Text: 10sp, weight 700

Status families:

Success:

- Statuses: `completed`, `delivered`, `paid`, `available`
- Text: `#168255`
- Background: success at 10 percent

Danger:

- Statuses: `failed`, `cancelled`, `rejected`
- Text: `#CE4444`
- Background: danger at 10 percent

Warning:

- Statuses: `pending`, `pending_approval`, `unpaid`
- Text: `#B77700`
- Background: warning at 12 percent

Neutral:

- Statuses: `offline`
- Text: `#7B8795`
- Background: neutral at 12 percent

Info:

- Default for all other statuses
- Text: `#2874BC`
- Background: info at 11 percent

Status labels:

```text
pending              Pending
approved             Approved
rider_assigned       Rider Assign
rider_accepted       Rider Accept
going_to_pickup      Going to pickup
arrived_at_pickup    At pickup
picked_up            Pick up
going_to_delivery    Going to delivery
arrived_at_delivery  At destination
delivered            Delivered
completed            Completed
failed               Failed
cancelled            Cancelled
```

### Address Block

Used inside job cards.

Layout:

```text
vertical line
green pickup marker    Pickup
                       Kabar Aye Market, Yankin
orange destination     Deliver to
                       Sanchaung Street, Sanchaung
```

Dimensions:

- Left padding: 19dp
- Gap between stops: 11dp
- Marker: 9dp circle
- Marker border: 2dp surface
- Outer marker shadow/border: 1dp border color
- Route line: 1dp, border color
- Stop label: 10sp uppercase, letter spacing 0.5
- Address: 12sp, bold, single line ellipsis

Pickup marker color: primary.

Destination marker color: `#D17D19`.

### Compact List Row

Used in GPS, notifications, and account health.

Row:

- Min height: 58dp
- Padding: 10dp vertical, 11dp horizontal
- Border bottom: 1dp except last row
- Gap: 10dp
- Background: transparent inside a glass/list container

Icon box:

- 32dp x 32dp
- Radius: 6dp
- Color: primary
- Background: primary soft

Text:

- Title: 12sp, single line ellipsis
- Detail: 11sp, muted, single line or 2 lines depending row

### Placeholder

Used for empty jobs, history, alerts, GPS unavailable.

Normal placeholder:

- Min height: 55 percent screen height
- Centered content

Compact placeholder:

- Min height: 220dp

Icon container:

- 52dp x 52dp
- Radius: 10dp
- Background: primary soft
- Icon color: primary

Title:

- H2 style, 17sp

Message:

- Body, muted
- Max width: 260dp
- Center aligned

### Filter Pills

Used in history.

Container:

- Horizontal row
- Gap: 5dp
- Margin top: 11dp
- Margin bottom: 14dp

Pill:

- Padding horizontal: 11dp
- Padding vertical: 6dp
- Radius: pill
- Font: 11sp, weight 700

Inactive:

- Background: surface
- Border: border
- Text: muted

Active:

- Background: primary
- Border: primary
- Text: white

### Form Field

Label:

- 11sp
- Weight: 700
- Color: muted

Input:

- Height: 43dp
- Padding horizontal: 11dp
- Radius: 6dp
- Background: surface
- Border: border
- Text: 13sp
- Focus border: primary
- Focus glow approximation: primary soft outline

### Toggle

Used for availability and COD.

Track:

- Width: 37dp
- Height: 21dp
- Radius: 30dp
- Off: border color
- On: primary

Thumb:

- 15dp x 15dp
- Top/left inset: 3dp
- White
- On translation: 16dp

## Navigation And State

### Default Route

After login or app start:

```text
Jobs tab
```

### Persistent Screen State

The web app stores:

- Last selected rider page
- Last selected order
- History filter

Android should store:

- Last selected bottom tab
- Last history filter

Do not restore job detail automatically after app cold start if the job may be stale. Instead:

1. Open Jobs tab.
2. Refresh active jobs.
3. If deep-linked from a notification, open job detail.

### Data Refresh

Topbar refresh button:

- Refresh bootstrap
- Refresh current tab data
- Refresh notifications count
- If on job detail, refresh that job

Socket event refresh:

- `order:assigned`: refresh active jobs and bootstrap
- `order:status-updated`: refresh current job if visible, refresh lists and summary
- `notification:created`: refresh unread count, optionally refresh notifications

## Screen 1: No Rider Profile

### When Shown

Show when authenticated user is a rider role but no rider profile is linked.

### Layout

Shell:

- Topbar visible
- No bottom nav required if there is no usable profile

Content:

```text
[center placeholder]
Icon: bike
Title: No rider profile
Message: Nothing to show here yet.
```

### UX

- User can refresh from topbar.
- If still missing, user must contact office.
- Do not show job, GPS, or account tabs.

## Screen 2: Jobs Tab

### Purpose

Primary rider workspace. Shows active assignments and duty toggle.

### Data

Use:

```http
GET /api/android/rider/bootstrap
GET /api/android/rider/jobs?scope=active
```

Fields:

- `rider.name`
- `rider.status`
- `rider.cash_held`
- `summary.active_jobs`
- `summary.unread_notifications`
- each job object
- local GPS tracking state
- local queued GPS count

### Layout

Content order:

```text
Rider hero
Mini metrics
Active assignments section
Job list
Load more footer when needed
Bottom nav
```

### Rider Hero

Web class: `.rider-hero`

Dimensions:

- Top padding: 34dp
- Bottom padding: 14dp
- Horizontal layout
- Left content and right availability toggle

Left:

```text
RIDER WORKSPACE
Good evening, {firstName}
[dot] GPS active - 10:34:21 AM, 2 queued
```

Copy rules:

- Eyebrow exactly: `RIDER WORKSPACE`
- Greeting exactly: `Good evening, {firstName}`
- Web currently always says "Good evening", not dynamic morning/afternoon. Match it unless product decides otherwise.

GPS line:

If duty active and last sent:

```text
GPS active - {localized lastSentAt time}
```

If duty active but no sent location:

```text
GPS starting
```

If inactive:

```text
GPS inactive
```

If queued count > 0 append:

```text
, {count} queued
```

Dot:

- 7dp circle
- Active: `#19A86B`
- Inactive: muted
- Margin right: 4dp

Right availability toggle:

```text
ACTIVE or OFFLINE
[toggle]
```

Label:

- `ACTIVE` when duty active
- `OFFLINE` when duty inactive
- 9sp, weight 700, primary

Tapping toggle:

- Off to on: call start duty
- On to off: call stop duty

Disable toggle while start/stop request is running.

### Mini Metrics

Web class: `.mini-metrics`

Grid:

- 2 columns
- Gap: 8dp

Cards:

- Glass background
- Padding: 12dp
- Radius: 7dp
- Gap: 7dp

Cards:

```text
ACTIVE JOBS
{active job count}

CASH HELD
{cash held formatted}
```

Label:

- Small uppercase
- Muted

Value:

- 18sp
- Bold

Money formatting:

Match web `money()` formatting. If no exact formatter is available, use:

```text
3,000 MMK
```

### Active Assignments Section

Spacing:

- Section top margin: 22dp

Heading:

```text
TODAY
Active assignments
```

Eyebrow margin bottom: 4dp.

### Empty State

If no active jobs:

```text
Icon: box
Title: No active assignments
Message: Nothing to show here yet.
```

### Job Card

Web class: `.delivery-list-card.rider-job.glass`

Card:

- Full width
- Padding: 14dp
- Radius: 8dp
- Text aligned left
- Glass background
- List gap: 10dp

Content:

```text
[FD-260712-ABCD]                          [Rider Assign badge]

Pickup
Kabar Aye Market, Yankin

Deliver to
Sanchaung Street, Sanchaung

[wallet] Delivery fee 3,000 MMK      [clock] 7/12/2026, 10:02 AM

[View next action                                      arrow-right]
```

Top row:

- Order code: 13sp, weight 700
- Status badge right aligned

Address block:

- Use reusable Address Block
- Margin: 16dp top, 13dp bottom

Meta row:

- Top border: 1dp
- Padding top: 10dp
- Margin vertical: 11dp
- Font: 11sp
- Muted
- Left: wallet icon + `Delivery fee {label}`
- Right: clock icon + updated time
- If text is too long, allow wrapping to two lines rather than overlap

Action:

- Full-width primary button
- Text: `View next action`
- Icon: arrowRight
- Min height: 39dp

Card tap:

- Opens Job Detail.

### Infinite Load

Web shows 8 jobs first, then loads more.

Android can use paginated API instead:

- First page: 15 or match API default
- Infinite scroll near bottom
- Optional button: `Load more jobs`
- Footer small text: `{showing} of {total}`

If implementing exact web behavior with local list:

- Show 8 initially
- Auto-load next 8 when footer appears
- Button label: `Load more jobs`

## Screen 3: Job History Tab

### Purpose

Shows completed, failed, and cancelled rider assignments.

### Data

Use:

```http
GET /api/android/rider/jobs?scope=history
```

With status filter:

```http
GET /api/android/rider/jobs?scope=history&status=completed
```

### Layout

Content order:

```text
PAST ASSIGNMENTS
Job history
History mini metrics
Filter pills
History list
Load more footer
```

### Header

Top padding from `.page-section`: 30dp.

Copy:

```text
PAST ASSIGNMENTS
Job history
```

### History Metrics

Web class: `.mini-metrics.history-metrics`

Margin:

- Top: 14dp
- Bottom: 4dp

The web uses 3 cards inside the same mini metric style. On narrow Android screens, keep 3 equal columns if it fits, or use horizontal scrolling. The current web CSS defines `.mini-metrics` as 2 columns globally, but the JSX renders 3 items. To match the visual intent, use 3 compact cards if the screen is at least 360dp wide; otherwise use 2 columns then wrap.

Cards:

```text
TOTAL JOBS
{history count}

COMPLETED
{completed count}

DELIVERY FEES
{sum of filtered completed delivery fees}
```

Important:

- `DELIVERY FEES` reflects the currently filtered list in the web implementation.
- If filter is `failed`, this usually becomes `0 MMK`.

### Filter Pills

Values and labels:

```text
All        all
Completed  completed
Failed     failed
Cancelled cancelled
```

Default:

```text
all
```

Persist selected filter locally.

### Empty State

If no matching history:

```text
Icon: clock
Title: No matching history
Message: Nothing to show here yet.
```

### History Card

Same as Job Card except final action line:

```text
View delivery details [chevronRight]
```

Style:

- Text color: primary
- Font: 11sp, weight 700
- Inline icon size: 15dp

Card tap:

- Opens Job Detail in history mode.

## Screen 4: Job Detail

### Purpose

Shows pickup and delivery stop details, product/payment summary, and next workflow actions.

### Entry

From:

- Job card
- History card
- Notification deep link

### Data

Use:

```http
GET /api/android/rider/jobs/{deliveryOrder}
```

Actions:

```http
POST /api/android/rider/jobs/{deliveryOrder}/action
```

### Layout

Content order:

```text
Back button
Header row with order code and status
Pickup stop card
Delivery stop card
Order summary
Cash collection note, only before complete step
Error message, if any
Sticky actions, active jobs only
```

No bottom nav appears while selected job detail is open in the web app. Match this. Use topbar and detail content, with sticky actions at bottom.

### Back Button

Copy:

- If active detail: `Active assignments`
- If history detail: `Job history`

Layout:

```text
[chevronLeft] Active assignments
```

Style:

- Transparent
- Text primary
- Font: 11sp, weight 700
- Margin bottom: 14dp

Tap:

- Return to previous list tab.

### Header Row

Layout:

```text
ACTIVE ASSIGNMENT                    [status badge]
FD-260712-ABCD
```

History mode:

```text
DELIVERY RECORD                      [status badge]
FD-260712-ABCD
```

Use `.card-row` behavior:

- Row aligns center
- Space between
- Gap: 10dp

### Stop Card

There are two stop cards.

Card style:

- Glass
- Margin bottom: 9dp
- Padding: 13dp
- Radius: 8dp

Pickup card:

```text
[green marker] PICKUP
Linn Fashion
Kabar Aye Market, Yankin

[phone] Call        [navigation] Navigate
```

Delivery card:

```text
[orange marker] DELIVERY
May Thu
Sanchaung Street, Sanchaung

[phone] Call        [navigation] Navigate
```

Heading row:

- Marker: 9dp
- Gap: 7dp
- Eyebrow text

Name:

- H3 style, 15sp
- Margin bottom: 6dp

Address:

- Body, muted, 13sp
- Margin bottom: 12dp

Action grid:

- 2 equal columns
- Gap: 7dp

Buttons:

- Call: secondary
- Navigate: primary

Behavior:

- Call uses `tel:` phone URI if available
- Navigate opens Google Maps query URL or Android geo intent
- If phone missing, keep disabled or remove call action. Web leaves anchor without href; native should disable it.

### Order Summary

Card style:

- Glass
- Margin bottom: 9dp
- Padding: 13dp
- Radius: 8dp
- Grid: 2 columns
- Gap: 10dp

Fields:

```text
PRODUCT
{package.name}

DELIVERY FEE
{delivery fee label}

PRODUCT COD
On - 12,500 MMK
or Off

LAST UPDATED
{updatedAt}      only history mode
```

Label:

- 9sp
- Weight 700
- Muted
- Uppercase
- Margin bottom: 4dp

Value:

- 13sp
- Weight 700

COD warning:

Shown if `money.cod_enabled` is true:

```text
[wallet] Cash on delivery: collect product payment from receiver.
```

Style:

- Grid span 2 columns
- Padding: 6dp
- Text: `#9A5700`
- Background: warning at 16 percent
- Border: warning at 22 percent
- Radius: 5dp
- Font: 11sp, weight 700
- Icon color: warning

Fragile warning:

Shown if `package.is_fragile` is true:

```text
Fragile item - Handle with care
```

Style:

- Grid span 2
- Padding: 6dp
- Text: warning
- Background: warning at 10 percent
- Radius: 5dp
- Font: 11sp, weight 700

### Cash Collection Note

Only shown when next action is `completed`.

Card:

- Glass
- Display flex row
- Gap: 10dp
- Margin bottom: 9dp
- Padding: 12dp
- Radius: 8dp
- Text/icon primary

Copy:

```text
Collect delivery fee in cash
Enter the final amount when you complete this order.
```

Icon box:

- 34dp x 34dp
- Radius: 7dp
- Background: primary soft
- Icon: wallet

### Sticky Actions

Only active jobs show sticky actions. History detail has no sticky actions.

Container:

- Fixed bottom
- Width: full phone, max 500dp on tablet
- Min height: 63dp
- Padding: 11dp vertical, 15dp horizontal
- Gap: 8dp
- Background: glass
- Top border: 1dp
- Elevation: 4dp

Actions:

```text
[more] Issue        {next action label} [arrowRight]
```

Issue button:

- Secondary
- Disabled when `can_report_issue` is false
- Copy: `Issue`

Primary button:

- Fills remaining width
- Copy from `next_action.label`
- Disabled if no next action
- Loading copy: `Saving...`
- If no action: `Workflow complete`

Behavior:

- `Confirm Accept`: send status `rider_accepted`
- `Pick up`: open Pickup Modal
- `Delivered`: send status `delivered`
- `Complete order`: open Complete Delivery Modal
- `Issue`: open Issue Modal

### Error Message

When action fails:

- Use same style as auth error
- Margin bottom: 12dp
- Padding: 8dp horizontal 10dp
- Color: `#B42323`
- Background: red at 9 percent
- Border: red at 18 percent
- Radius: 6dp
- Font: 12sp

## Screen 5: Pickup Modal

### Trigger

Job detail primary button when next status is `picked_up`.

### Modal Style

Web uses centered modal with dim backdrop.

Android should use a bottom sheet or centered dialog. To visually match web mobile, use a centered dialog on larger screens and bottom sheet on small phones if needed. The content must match.

Backdrop:

- Color: `#590A1318` approximately 35 percent black-blue

Dialog:

- Width: 92 percent screen, max 430dp
- Max height: 90 percent screen, max 680dp
- Glass background
- Radius: 10dp
- Padding top: 18dp
- Internal horizontal padding: 16dp

Header:

```text
PICK UP                         [close]
Destination and COD
```

Description:

```text
Confirm destination details and product payment before pickup.
```

Fields:

```text
Destination name
Destination phone
Destination address
Product COD [toggle]
COD amount (MMK), only if Product COD on
```

Initial values:

- Destination name: current receiver name
- Destination phone: current receiver phone
- Destination address: current destination address
- COD toggle: current `money.cod_enabled`
- COD amount: current `money.cod_amount`

Validation:

- Destination phone required
- Destination address required
- COD amount required if COD on

Actions:

```text
Cancel             Pick up [check]
```

Sticky modal action bar:

- Bottom sticky
- Padding: 12dp vertical, 16dp horizontal
- Gap: 7dp
- Background: glass
- Top border: 1dp

Submit loading:

```text
Saving...
```

Submit request:

```json
{
  "status": "picked_up",
  "receiver_name": "...",
  "receiver_phone": "...",
  "receiver_address": "...",
  "product_payment_method": "rider_collects",
  "cod_amount": 12500
}
```

On success:

- Close modal
- Refresh current GPS position if permission allows
- Update job detail

## Screen 6: Complete Delivery Modal

### Trigger

Job detail primary button when next status is `completed`.

### Header

```text
COMPLETE DELIVERY               [close]
Final delivery fee
```

Description:

```text
Enter the cash amount collected from the client for this delivery.
```

### COD Summary

Always shown.

Inactive COD:

```text
[wallet]
Product COD
Off
```

Active COD:

```text
[wallet]
Product COD     COD amount
On              12,500 MMK
```

Style:

- Margin bottom: 14dp
- Padding: 10dp
- Radius: 8dp
- Border: border
- Background: soft surface
- Grid:
  - inactive: icon + 1fr
  - active: icon + 1fr + 1fr

Active COD style:

- Background: warning at 9 percent
- Border: warning at 28 percent
- Icon text: warning dark
- Icon bg: warning at 16 percent

### Delivery Fee Input

Label:

```text
Delivery fee (MMK)
```

Input container:

- Height min: 58dp
- Grid: 38dp icon, flexible input, suffix text
- Gap: 8dp
- Padding: left 10dp, right 11dp, vertical 8dp
- Radius: 8dp
- Background: surface
- Border: border
- Focus border: primary

Icon box:

- 34dp x 34dp
- Radius: 7dp
- Background: primary soft
- Icon: wallet, primary

Input:

- Numeric
- Text size: 24sp
- Weight: 700
- Placeholder: `3000`
- Suffix: `MMK`, 11sp, weight 800

Actions:

```text
Cancel             Complete order [check]
```

Submit request:

```json
{
  "status": "completed",
  "delivery_fee": 3000
}
```

On success:

- Close modal
- Close job detail
- Navigate to History tab

## Screen 7: Issue Modal

### Trigger

Job detail `Issue` button.

### Header

```text
DELIVERY ISSUE                  [close]
Report problem
```

Description:

```text
Use this when the delivery cannot continue. The order will move to history.
```

Field:

```text
Issue note
```

Placeholder:

```text
Receiver unavailable, package problem...
```

Actions:

```text
Cancel      Mark failed      Cancel job
```

Button styles:

- Cancel: secondary
- Mark failed: danger
- Cancel job: primary

Submit:

Mark failed:

```json
{
  "status": "failed",
  "note": "Receiver unavailable"
}
```

Cancel job:

```json
{
  "status": "cancelled",
  "note": "Package problem"
}
```

On success:

- Close modal
- Close job detail
- Navigate to History tab

## Screen 8: GPS Tab

### Purpose

Shows duty tracking state, map, privacy note, GPS controls, and detailed tracking rows.

### Data

Use:

```http
GET /api/android/rider/bootstrap
POST /api/android/rider/duty/start
POST /api/android/rider/duty/stop
POST /api/android/rider/locations
POST /api/android/rider/gps-events
```

Also use local Android permission and queue state.

### Layout

Content order:

```text
TRACKING STATUS
GPS location
GPS visual card
Map, only active duty
Privacy note
GPS warning, only if message exists
Start/Stop action grid
Compact status list
```

### Header

```text
TRACKING STATUS
GPS location
```

Use page-section top padding 30dp.

### GPS Visual Card

Web class: `.gps-visual.glass`

Card:

- Margin top: 15dp
- Margin bottom: 12dp
- Padding: 24dp vertical, 14dp horizontal
- Radius: 8dp
- Center aligned

Icon circle:

- 57dp x 57dp
- Circle
- Margin bottom: 11dp

Inactive:

- Icon color: primary
- Icon background: primary soft
- Title: `GPS tracking is off`
- Body: `Tap Start active when you are ready to receive assignments.`

Active:

- Icon color: `#19A86B`
- Icon background: green at 13 percent
- Title: `Active duty tracking`
- Body: `Your working-hours location is shared with office operations.`

### GPS Map

Shown only when duty active.

If position unavailable:

```text
[mapPin icon]
Waiting for your GPS position
Start active and allow location permission to show your current point on the map.
```

Unavailable card:

- Glass
- Min height: 156dp
- Padding: 18dp
- Radius: 8dp
- Center aligned
- Icon box: 42dp x 42dp, radius 9dp, primary soft

If position exists:

- Map card min height: 230dp
- Radius: 8dp
- Uses map tiles from `app_config.map_tile_url`
- Center map on current location
- Zoom approximately 16

Marker:

- 34dp circle
- Border: 3dp white
- Active background: `#19A86B`
- Inner dot: 10dp white
- Inner halo: white at 22 percent

Bottom map status overlay:

```text
[navigation icon]
Your live position
16.84094, 96.17353 - 18m accuracy
```

Overlay:

- Position: left/right/bottom 10dp
- Min height: 54dp
- Padding: 9dp
- Gap: 9dp
- Background: surface at 90 percent
- Border: border
- Radius: 8dp
- Elevation: 4dp

### Privacy Note

Card:

- Glass
- Display row
- Gap: 9dp
- Margin bottom: 12dp
- Padding: 10dp
- Radius: 8dp

Icon box:

- 30dp x 30dp
- Radius: 7dp
- Background: primary soft
- Icon: lock

Copy:

Active:

```text
Location sharing is on
Office can see your live position only while you are active. Clients see only their assigned rider after pickup. Stop active turns rider location sharing off.
```

Inactive:

```text
Location sharing is off
Office can see your live position only while you are active. Clients see only their assigned rider after pickup. Stop active turns rider location sharing off.
```

Title:

- 12sp
- Weight 700

Body:

- 11sp
- Muted
- Line height about 1.45

### GPS Warning

Shown only when tracking has a warning message.

Examples:

```text
Location permission was denied. You can continue working, but office cannot see your live position.
Location is unavailable right now. Move outside or check GPS/network settings.
Location request timed out. Tracking will retry automatically.
This browser does not support GPS tracking.
```

For native Android, replace browser wording where needed:

```text
This device does not support GPS tracking.
```

Style:

- Margin bottom: 12dp
- Padding: 10dp
- Gap: 7dp
- Text color: `#9C6500`
- Background: warning at 10 percent
- Border: warning at 22 percent
- Radius: 8dp
- Font: 11sp, weight 700

### GPS Actions

Grid:

- 2 columns
- Gap: 7dp
- Margin bottom: 12dp

Buttons:

```text
[navigation] Start active
[close] Stop active
```

Start active:

- Primary
- Disabled if already active or starting

Stop active:

- Secondary
- Disabled if not active

### GPS Compact Status List

Container:

- Glass
- Radius: 8dp
- Overflow hidden

Rows:

1. Rider status
2. Location permission
3. Android GPS notification
4. Adaptive update frequency
5. Offline queue
6. Active assignments
7. Current position
8. Accuracy
9. Last sent

Exact row copy:

Rider status:

```text
Rider status
{rider.status with underscores replaced by spaces}
[status badge]
```

Location permission:

```text
Location permission
Waiting for location permission
or granted / denied / approximate
[status badge]
```

For native Android, use `Android GPS notification` instead of web's `PWA GPS notification`:

```text
Android GPS notification
Available while the foreground service is running
[Available badge]
```

Adaptive update frequency:

```text
Adaptive update frequency
15s while moving, 45-60s when stationary
Sending...
```

Offline queue:

```text
Offline queue
No queued GPS updates
```

If queued:

```text
{count} location update(s) waiting to sync
```

Right small text while flushing:

```text
Syncing...
```

Active assignments:

```text
Active assignments
{count} current job(s)
```

Current position:

```text
Current position
16.84094, 96.17353
```

If no position:

```text
No GPS point sent yet
```

Accuracy:

```text
18 meters
```

If unknown:

```text
Unknown
```

Last sent:

```text
7/12/2026, 10:05 AM
```

If none:

```text
Not sent yet
```

## Screen 9: Notifications Tab

### Purpose

Shows push notification status and delivery alerts.

### Data

Use:

```http
GET /api/android/rider/notifications
PATCH /api/android/rider/notifications/{id}/read
POST /api/android/rider/device-token
DELETE /api/android/rider/device-token
```

### Layout

Content order:

```text
ALERTS
Notifications
Push alert panel, if push status exists
Notification list or empty placeholder
Load more alerts footer
```

### Header

```text
ALERTS
Notifications
```

### Push Alert Panel

Web class: `.push-alert-panel.glass`

Layout:

```text
[bell icon]  Push disabled
             Push alerts are off on this device.        [Enable]
```

Grid:

- 34dp icon
- Flexible text
- Optional action button
- Gap: 10dp
- Margin bottom: 12dp
- Padding: 11dp
- Radius: 8dp

Icon box:

- 34dp x 34dp
- Radius: 7dp
- Primary icon
- Primary soft background

Title:

- 12sp
- Weight 700

Detail:

- 11sp
- Muted

Push states:

| State | Title | Button |
| --- | --- | --- |
| default | Push disabled | Enable |
| disabled | Push disabled | Enable |
| enabled | Push enabled | Disable |
| working | Push alerts | none |
| unconfigured | Push not configured | none |
| blocked | Push blocked | none or open settings |
| unsupported | Push unavailable | none |
| error | Push unavailable | Enable |

### Empty Notifications

If no notifications:

```text
[bell icon]
No alerts yet
Delivery updates will appear here when your order is reviewed, a rider is assigned, or the delivery status changes.
```

Use compact placeholder:

- Glass
- Min height: 220dp

### Notification Row

Container:

- Compact list glass

Row:

- Compact row style
- Button behavior
- If unread, background: primary at 7 percent
- If unread, icon box: primary soft

Content:

```text
[bell icon] New delivery assignment
            Pickup is ready for FD-260712-ABCD.
            FD-260712-ABCD - 7/12/2026, 10:04 AM
```

Tap behavior:

- If unread, mark as read
- Optionally if notification has `order_id`, open job detail after marking read
- Web only marks read; opening detail is acceptable as a native improvement if it does not disrupt reading alerts

Load more footer:

```text
Load more alerts
{showing} of {total}
```

## Screen 10: Account Tab

### Purpose

Shows rider profile, connection health, profile form, password fields, photo upload, and logout.

### Data

Use:

```http
GET /api/android/rider/bootstrap
PATCH /api/user
POST /api/user/profile
POST /api/auth/logout
```

### Layout

Content order:

```text
ACCOUNT
Rider profile
Connection status panel
Account form panel
Logout button
```

Screen bottom padding:

- 86dp

### Header

```text
ACCOUNT
Rider profile
```

### Account Health Panel

Card:

- Glass
- Margin bottom: 12dp
- Padding: 12dp
- Radius: 8dp

Heading:

```text
HEALTH
Connection status
```

List rows:

Socket server:

```text
[refresh icon]
Socket server
Realtime order updates are connected.
[Available badge]
```

If disconnected:

```text
Realtime updates are offline. Use refresh if updates look stale.
[Offline badge]
```

Push notification:

```text
[bell icon]
Push notification
Push alerts are enabled on this device.
[Available badge]
```

Status badge values:

- Socket connected: `available`
- Socket disconnected: `offline`
- Push enabled: `available`
- Push disabled/checking: `pending`
- Push blocked/error/unsupported: `failed`

### Account Form Panel

Card:

- Glass
- Padding: 13dp
- Radius: 8dp
- Gap: 10dp

Profile summary:

```text
[avatar]
Aung Rider
R-001 - available
```

Style:

- Glass
- Min height: 58dp
- Padding: 9dp
- Radius: 8dp
- Gap: 10dp

Avatar:

- 42dp circle
- If photo exists, image cover
- Else initials
- Background: primary soft
- Text: primary, 12sp, weight 900

Photo upload row:

```text
[avatar]
Profile photo
JPG or PNG up to 2 MB
```

Style:

- Glass
- Min height: 54dp
- Padding: 8dp horizontal 9dp
- Radius: 8dp
- Tapping opens image picker

Fields:

```text
Full name
Phone number
Email
```

Password group:

- Top border: 1dp
- Padding top: 12dp
- Margin top: 2dp
- Gap: 10dp

Copy:

```text
PASSWORD
Current password
New password
Confirm new password
```

Validation:

- If new password and confirmation mismatch, show:

```text
New password and confirmation do not match.
```

Success:

```text
Profile saved.
```

Style success:

- Text success
- 12sp
- Small margin

Submit button:

```text
Save profile
```

Loading:

```text
Saving...
```

Button:

- Primary
- Full width

### Logout

Button:

```text
[lock] Logout
```

Style:

- Secondary
- Full width
- Margin top: 16dp

Behavior:

1. Call logout API.
2. Clear token.
3. Clear cached user/rider data.
4. Disconnect socket.
5. Stop foreground GPS tracking.
6. Navigate to login.

## Screen 11: Login Screen

The web login is shared across portals, but Android needs a rider-only login.

To match current visual style, use the same auth panel language:

Container:

- Root background same as app background
- Centered panel
- Horizontal padding: 18dp

Panel:

- Width: match parent up to 390dp
- Glass
- Padding: 20dp
- Radius: 8dp

Brand row:

```text
[logo mark]
FlowDrop Delivery
Rider
```

Fields:

```text
Email
Password
```

Primary button:

```text
Login
```

Loading:

```text
Signing in...
```

Error style:

- Same auth error red panel

After success:

1. Save token.
2. Save user/rider/app_config.
3. Save FCM token if available.
4. Bootstrap.
5. Open Jobs tab.

## Foreground GPS Notification UX

The web app has a PWA GPS notification concept. Native Android should use a foreground service notification when active duty tracking is on.

Notification content:

Title:

```text
FlowDrop GPS tracking active
```

Body examples:

```text
Last sent 10:05 AM - 18m accuracy
2 queued GPS updates waiting to sync
Waiting for GPS position
```

Actions:

- Open app
- Stop active, optional if implementation supports safe service action

Notification is required while background GPS is active.

## Loading States

### Full Screen Initial Loading

Use simple centered loading inside shell:

```text
Loading...
```

Do not use large animation.

### Pull To Refresh

Use native swipe refresh on:

- Jobs
- History
- GPS
- Notifications
- Account

Refresh color:

- Primary

### Button Loading

Replace button text:

- `Saving...`
- `Signing in...`

Disable all competing actions while request is running.

## Offline States

### API Offline

If API request fails due to network:

- Keep existing cached screen content
- Show a small red error panel near top of content:

```text
Could not refresh. Check your connection.
```

### GPS Offline Queue

Use GPS row copy exactly:

```text
No queued GPS updates
```

or

```text
{count} location update(s) waiting to sync
```

When sync starts, show:

```text
Syncing...
```

## Deep Links From Push

If FCM payload includes `order_id`:

1. Open app.
2. Authenticate with saved token.
3. Fetch job detail.
4. If allowed, open Job Detail.
5. If not found or no longer assigned, open Jobs tab and show a short message:

```text
This delivery is no longer available.
```

If no `order_id`, open Notifications tab.

## Exact Copy Reference

### Bottom Tabs

```text
Jobs
History
GPS
Alerts
Account
```

### Jobs Screen

```text
RIDER WORKSPACE
Good evening, {firstName}
GPS active - {time}
GPS starting
GPS inactive
ACTIVE
OFFLINE
ACTIVE JOBS
CASH HELD
TODAY
Active assignments
No active assignments
View next action
Load more jobs
```

### History Screen

```text
PAST ASSIGNMENTS
Job history
TOTAL JOBS
COMPLETED
DELIVERY FEES
All
Completed
Failed
Cancelled
No matching history
View delivery details
Load more history
```

### Detail Screen

```text
Active assignments
Job history
ACTIVE ASSIGNMENT
DELIVERY RECORD
PICKUP
DELIVERY
Call
Navigate
PRODUCT
DELIVERY FEE
PRODUCT COD
LAST UPDATED
Cash on delivery: collect product payment from receiver.
Fragile item - Handle with care
Collect delivery fee in cash
Enter the final amount when you complete this order.
Issue
Workflow complete
```

### Workflow

```text
Confirm Accept
Pick up
Delivered
Complete order
```

### Pickup Modal

```text
PICK UP
Destination and COD
Confirm destination details and product payment before pickup.
Destination name
Destination phone
Destination address
Product COD
Collect product payment from receiver
COD amount (MMK)
Cancel
Saving...
Pick up
```

### Complete Modal

```text
COMPLETE DELIVERY
Final delivery fee
Enter the cash amount collected from the client for this delivery.
Product COD
COD amount
Delivery fee (MMK)
MMK
Cancel
Complete order
```

### Issue Modal

```text
DELIVERY ISSUE
Report problem
Use this when the delivery cannot continue. The order will move to history.
Issue note
Receiver unavailable, package problem...
Cancel
Mark failed
Cancel job
```

### GPS Screen

```text
TRACKING STATUS
GPS location
Active duty tracking
Your working-hours location is shared with office operations.
GPS tracking is off
Tap Start active when you are ready to receive assignments.
Waiting for your GPS position
Start active and allow location permission to show your current point on the map.
Location sharing is on
Location sharing is off
Office can see your live position only while you are active. Clients see only their assigned rider after pickup. Stop active turns rider location sharing off.
Start active
Stop active
Rider status
Location permission
Android GPS notification
Adaptive update frequency
15s while moving, 45-60s when stationary
Offline queue
Active assignments
Current position
Accuracy
Last sent
No GPS point sent yet
Unknown
Not sent yet
```

### Notifications Screen

```text
ALERTS
Notifications
Push disabled
Push enabled
Push alerts
Push not configured
Push blocked
Push unavailable
Enable
Disable
No alerts yet
Delivery updates will appear here when your order is reviewed, a rider is assigned, or the delivery status changes.
Load more alerts
```

### Account Screen

```text
ACCOUNT
Rider profile
HEALTH
Connection status
Socket server
Realtime order updates are connected.
Realtime updates are offline. Use refresh if updates look stale.
Push notification
Profile photo
JPG or PNG up to 2 MB
Full name
Phone number
Email
PASSWORD
Current password
New password
Confirm new password
New password and confirmation do not match.
Profile saved.
Save profile
Saving...
Logout
```

## Android XML Structure Recommendation

Use one Activity with multiple Fragments.

```text
RiderActivity
  LoginFragment, when unauthenticated
  RiderShellFragment, when authenticated
    Topbar layout
    FragmentContainerView for tabs/detail
    Bottom nav layout
```

Fragments:

```text
JobsFragment
HistoryFragment
JobDetailFragment
GpsFragment
NotificationsFragment
AccountFragment
```

Dialogs:

```text
PickupDialogFragment
CompleteDeliveryDialogFragment
IssueDialogFragment
```

Services:

```text
RiderLocationForegroundService
SocketManager singleton
FcmService
```

Recommended reusable XML components:

```text
view_topbar.xml
view_bottom_nav.xml
view_status_badge.xml
view_job_card.xml
view_address_block.xml
view_compact_row.xml
view_glass_metric.xml
view_empty_placeholder.xml
view_primary_button.xml
view_secondary_button.xml
```

## Acceptance Checklist

Use this checklist before approving the Android UI.

Global:

- Topbar height is 57dp.
- Bottom nav has exactly 5 tabs.
- Bottom nav badges match web behavior.
- Content horizontal padding is 15dp.
- Cards use 8dp radius, not large rounded cards.
- Primary color is `#087F74`.
- Status badge colors match web families.
- Typography is compact and close to web sizes.
- Light and dark mode both work if dark mode is included.

Jobs:

- Greeting says `Good evening, {firstName}`.
- Availability toggle starts and stops duty.
- Active jobs and cash held cards appear before assignments.
- Job cards show order code, badge, route, meta, and `View next action`.
- Empty state says `No active assignments`.

History:

- Header says `PAST ASSIGNMENTS` and `Job history`.
- Metrics show total, completed, delivery fees.
- Filter pills are All, Completed, Failed, Cancelled.
- History cards say `View delivery details`.

Detail:

- Bottom nav is hidden on detail.
- Back button text changes for active vs history.
- Pickup and delivery cards include Call and Navigate.
- Summary has product, delivery fee, product COD, and last updated in history.
- Sticky actions appear only for active jobs.
- Workflow modals match copy and fields.

GPS:

- GPS card changes active/inactive copy.
- Map appears only when duty active.
- Privacy note copy matches.
- Start active and Stop active buttons match web.
- Compact list contains all 9 rows.
- Offline queue and last sent states are visible.

Notifications:

- Push panel appears above list.
- Unread rows have primary-tinted background.
- Tapping unread marks it read.
- Empty state copy matches.

Account:

- Health panel has socket and push rows.
- Profile summary and photo upload rows match.
- Password section is separated by top border.
- Logout is secondary full-width.

Realtime and refresh:

- Socket status badge changes connected/disconnected.
- Refresh button reloads current data.
- Socket events refresh list/detail counters.

GPS service:

- Foreground notification starts when duty active.
- Location stops when duty inactive.
- Offline GPS queue survives app restart.
- Permission denied state is reported and visible.
