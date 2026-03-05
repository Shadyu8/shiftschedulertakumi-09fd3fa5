# Shift Planner — Application Specification
## Part 4: Data Model, Design System & Business Logic (Sections 6–10)

> **Document Series:**
> - [Part 1: Whole Application Overview](APP_SPECIFICATION_PART_1_OVERVIEW.md)
> - [Part 2: Admin & Manager Screens](APP_SPECIFICATION_PART_2_ADMIN_MANAGER.md) — Login, Admin screens, Manager screens (5.1–5.11)
> - [Part 3: Worker, Kiosk & Shared Screens](APP_SPECIFICATION_PART_3_WORKER_KIOSK.md) — Worker, Shift Leader, Kiosk, Account Settings (5.12–5.19)
> - **Part 4 (this file):** Data Model, Design System & Business Logic — Data model, design system, business rules, notifications, accessibility

---

## Table of Contents

6. [Data Model](#6-data-model)
7. [Design System & Styling](#7-design-system--styling)
8. [Business Logic & Rules](#8-business-logic--rules)
9. [Notifications & Feedback](#9-notifications--feedback)
10. [Accessibility & Responsiveness](#10-accessibility--responsiveness)
- [Appendix: Screen Flow Summary](#appendix-screen-flow-summary)

---

## 6. Data Model

### Tables & Relationships

```
organizations
├── id (UUID, primary key)
├── name (text)
└── created_at (timestamp)

locations
├── id (UUID, primary key)
├── name (text)
├── organization_id (UUID → organizations.id)
├── timezone (text)
└── created_at (timestamp)

profiles
├── id (UUID, primary key)
├── user_id (UUID → auth.users.id)
├── full_name (text)
├── username (text, unique)
├── phone (text, optional)
├── profile_picture (text/URL, optional)
├── organization_id (UUID → organizations.id)
├── active (boolean, default true)
├── availability_locked (boolean, default false)
├── unique_key (text, 5-digit PIN for kiosk — consider hashing for security in production)
└── created_at (timestamp)

user_roles
├── id (UUID, primary key)
├── user_id (UUID → auth.users.id)
└── role (enum: admin, manager, shiftleader, worker, kiosk)

user_locations
├── id (UUID, primary key)
├── user_id (UUID → auth.users.id)
└── location_id (UUID → locations.id)

shifts
├── id (UUID, primary key)
├── user_id (UUID → auth.users.id)
├── date (date)
├── start_time (time)
├── end_time (time, optional)
├── location_id (UUID → locations.id)
├── published (boolean, default false)
├── standby (boolean, default false)
└── created_at (timestamp)

time_punches
├── id (UUID, primary key)
├── user_id (UUID → auth.users.id)
├── date (date)
├── punch_in (timestamp)
├── punch_out (timestamp, nullable)
├── location_id (UUID → locations.id)
├── approved (boolean, default false)
├── approved_by (UUID → auth.users.id, nullable)
├── notes (text, optional)
└── created_at (timestamp)

availability
├── id (UUID, primary key)
├── user_id (UUID → auth.users.id)
├── week_start (date)
├── day_of_week (integer, 0=Monday to 6=Sunday)
├── available (boolean)
├── start_time (time, optional)
├── end_time (time, optional)
├── preset (text — one of: ALL_DAY, UNTIL_16:00, UNTIL_17:00, FROM_13:00, FROM_14:00, FROM_15:00, FROM_16:00, FROM_17:00, UNAVAILABLE, CUSTOM)
├── location_id (UUID → locations.id)
└── created_at (timestamp)

availability_exceptions
├── id (UUID, primary key)
├── user_id (UUID → auth.users.id)
├── date (date)
├── available (boolean)
├── start_time (time, optional)
├── end_time (time, optional)
├── reason (text, optional)
└── preset (text)

availability_templates
├── id (UUID, primary key)
├── user_id (UUID → auth.users.id)
├── name (text)
├── entries (JSON — array of day availability objects)
├── location_id (UUID → locations.id)
└── created_at (timestamp)

location_settings
├── id (UUID, primary key)
├── location_id (UUID → locations.id)
├── time_entry_mode (text: dropdown, free)
├── time_entry_increment_mins (integer: 15 or 30)
├── earliest_shift_start (time)
├── latest_shift_end (time)
├── breaks_enabled (boolean)
├── availability_deadline_day (text: day of week)
├── availability_deadline_time (time)
├── availability_from_start (time)
├── availability_from_end (time)
├── availability_to_start (time)
└── availability_to_end (time)

kiosk_accounts
├── id (UUID, primary key)
├── user_id (UUID → auth.users.id)
├── location_id (UUID → locations.id)
└── created_by (UUID → auth.users.id)
```

### Key Relationships

- An **organization** has many **locations**
- A **location** has many **workers** (via user_locations), **shifts**, **time_punches**, and one **location_settings**
- A **user** (profile) belongs to one **organization**, can be assigned to one or more **locations**, has one **role**, and has many **shifts**, **time_punches**, and **availability** records
- **Availability** is per-user, per-week, per-day, per-location
- **Shifts** are per-user, per-date, per-location
- **Time punches** track clock-in/out per-user, per-date, with approval workflow

---

## 7. Design System & Styling

### Color Palette

**Light Mode:**

| Token | HSL | Hex Approximation | Usage |
|-------|-----|-------------------|-------|
| Background | 210° 20% 98% | #F5F7FA | Page background |
| Foreground | 220° 25% 10% | #131A24 | Primary text |
| Primary | 221° 83% 53% | #3B82F6 | Buttons, links, active states |
| Primary Foreground | 210° 40% 98% | #F5F8FC | Text on primary backgrounds |
| Success (chart-green) | 142° 71% 45% | #22C55E | Positive actions, clock-in |
| Destructive | 0° 72% 51% | #EF4444 | Errors, delete, clock-out |
| Warning (chart-orange) | 38° 92% 50% | #F97316 | Warnings, caution states |
| Muted | 210° 20% 96% | #F0F4F8 | Subtle backgrounds |
| Muted Foreground | 215° 15% 47% | #64748B | Secondary text |
| Card | 0° 0% 100% | #FFFFFF | Card backgrounds |
| Border | 214° 20% 90% | #DDE5EF | Borders, dividers |
| Accent | 210° 20% 96% | #F0F4F8 | Hover backgrounds |

**Dark Mode:**

| Token | HSL | Hex Approximation | Usage |
|-------|-----|-------------------|-------|
| Background | 222° 30% 7% | #0D1117 | Page background |
| Foreground | 210° 20% 95% | #E8EDF2 | Primary text |
| Primary | 221° 83% 53% | #3B82F6 | Same blue primary |
| Card | 222° 25% 10% | #141B27 | Card backgrounds |
| Border | 220° 20% 18% | #232D3D | Borders, dividers |
| Muted | 220° 20% 14% | #1A2332 | Subtle backgrounds |

**Sidebar (Dark-themed in both modes):**

| Token | HSL | Usage |
|-------|-----|-------|
| Background | 220° 25% 10% | Sidebar background |
| Foreground | 210° 20% 85% | Sidebar text |
| Primary | 221° 83% 53% | Active item highlight |
| Accent | 220° 20% 15% | Hover state |
| Border | 220° 20% 18% | Sidebar borders |

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Body text | Inter | 400 (Regular) | 16px base |
| Headings (H1) | Inter | 700-800 (Bold/Extrabold) | 24-30px |
| Headings (H2) | Inter | 600-700 (Semibold/Bold) | 20-24px |
| Headings (H3) | Inter | 600 (Semibold) | 18px |
| Small/muted text | Inter | 400 | 12-14px |
| Monospace (codes, PINs) | JetBrains Mono | 400-500 | Varies |
| Button text | Inter | 500-600 | 14-16px |

### Spacing & Layout

| Property | Value |
|----------|-------|
| Border radius (default) | 12px (0.75rem) |
| Card padding | 16-24px |
| Grid gap | 16px |
| Section spacing | 24-32px |
| Touch target minimum | 44×44px |

### Component Styles

**Stat Card:**
- White/card background
- 1px border in border color
- Subtle box shadow
- 12px border radius
- Hover: slight lift effect (translateY -1px) with enhanced shadow
- Transition: 200ms ease

**Glass Card (special):**
- Semi-transparent white background (50% opacity)
- Backdrop blur (8px)
- Used for overlay content

**Buttons:**
- Primary: Blue background, white text, full rounded corners
- Destructive: Red background, white text
- Outline: Transparent with border, foreground text
- Ghost: Transparent, foreground text, subtle hover background
- All buttons: 200ms transitions, disabled state with reduced opacity

**Input Fields:**
- Full-width by default
- Border in input-border color
- 12px border radius
- Focus: primary-colored ring/border
- Placeholder text in muted foreground color

**Badges/Status Indicators:**
- Small rounded pills
- Color-coded: blue (info), green (success/active), red (error/inactive), yellow (warning/pending)
- Used for role labels, approval status, shift status

**Toast Notifications:**
- Slide in from top or bottom
- Auto-dismiss after 3-5 seconds
- Types: success (green), error (red), info (blue), warning (orange)

### Animations

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| Fade in | 300ms | ease-out | Page transitions, modals |
| Slide in | 200ms | ease | Drawers, bottom sheets |
| Hover lift | 200ms | ease | Cards on hover |
| Pulse | 2000ms | infinite | Loading states |
| Accordion | 200ms | ease | Expanding/collapsing sections |

---

## 8. Business Logic & Rules

### Shift Scheduling

1. Shifts are created per-worker, per-date, per-location.
2. A shift has a start time (required) and optional end time.
3. Shifts can be marked as "standby" (backup worker).
4. Shifts start as unpublished (draft) and must be explicitly published.
5. Published shifts are visible to workers on their schedule.
6. Time slots for shifts are constrained by location settings (earliest start, latest end, increment).

### Availability

1. Workers submit availability per-week, per-day, per-location.
2. Availability presets simplify submission (All Day, From/Until X, Custom, Unavailable).
3. Managers see availability in the schedule builder as yellow indicators.
4. Availability can be locked by the manager or auto-locked after the deadline.
5. Templates allow workers to save and reuse common availability patterns.
6. Past weeks cannot be edited.

### Time Punches

1. Workers clock in and out via the kiosk (PIN entry) or potentially through the app.
2. Punch-in times are rounded to the nearest quarter hour with a 7-minute boundary.
3. If punching in early (before shift start), the punch is recorded at the shift start time.
4. Punches require manager approval before they count in export reports.
5. Managers can approve or reject individual punches.
6. Only approved punches appear in CSV exports.

### Kiosk

1. A 5-digit PIN uniquely identifies each worker.
2. Rate limiting: 5 failed PIN attempts triggers a 60-second lockout.
3. Failed attempts have a 1.5-second delay (brute-force protection).
4. Exiting kiosk mode requires password verification.
5. Kiosk is location-specific — only workers assigned to that location can punch in.

### Exports

1. Only approved punches are exported.
2. Reports are filtered by month and optionally by individual worker.
3. The "All Workers" report shows total hours per worker.
4. Individual worker reports show detailed punch records with dates, times, hours, and location.
5. Export format is CSV with appropriate file naming.

---

## 9. Notifications & Feedback

### Toast Messages

Used for success/error feedback after user actions:
- "Shift created successfully"
- "Availability submitted"
- "Punch approved"
- "Schedule published"
- "Export generated"
- "Invalid username or password" (login error)
- "Failed to save changes" (generic error)

### Status Indicators

- **Loading spinner** — Shown during data fetches and form submissions
- **Empty states** — Descriptive messages when lists are empty (e.g., "No shifts scheduled this week")
- **Approval badges** — Pending (yellow), Approved (green), Rejected (red)
- **Active/Inactive badges** — Green for active, gray for inactive workers
- **Kiosk feedback banner** — Full-width colored banner with icon and message, auto-dismisses

---

## 10. Accessibility & Responsiveness

### Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, bottom tab navigation, compact cards |
| Tablet | 640–1024px | Two-column grids, sidebar begins to show |
| Desktop | > 1024px | Multi-column grids (3-4 columns), full sidebar |

### Mobile-Specific Features

- Bottom tab bar navigation (fixed, safe-area aware)
- Swipe gestures for schedule navigation (day/week switching)
- Touch-friendly tap targets (minimum 44×44px)
- Responsive cards that stack vertically on small screens
- Bottom sheet modals instead of centered dialogs on mobile
- Safe area padding for notched devices (iPhone notch, dynamic island)

### Accessibility Features

- Semantic labeling on all interactive elements
- High contrast color ratios for text
- Focus indicators on interactive elements
- Keyboard navigable (for web; translate to screen reader support for mobile)
- Loading states announced to users
- Error messages clearly associated with their form fields

### Dark Mode

- Full dark mode support using system theme detection
- All colors have dark mode variants (defined in the color palette above)
- Images and avatars work in both modes
- Sidebar maintains its dark theme in both light and dark modes

---

## Appendix: Screen Flow Summary

```
App Launch
  │
  ├── Not Authenticated → Login Screen
  │                          │
  │                          └── Authenticate → Role-based redirect
  │
  └── Authenticated → Role-based Dashboard
         │
         ├── Admin Dashboard
         │     ├── Organizations (CRUD)
         │     ├── Locations (CRUD)
         │     └── Managers (CRUD)
         │
         ├── Manager Dashboard
         │     ├── Workers (CRUD)
         │     ├── Schedule Builder (Week grid, shifts, availability)
         │     ├── Punch Approvals (Approve/Reject)
         │     ├── Exports (CSV by month/worker)
         │     ├── Location Settings (Config)
         │     ├── Kiosk Mode (PIN terminal)
         │     └── Shift Schedule (View all)
         │
         ├── Shift Leader Dashboard
         │     ├── Kiosk Mode (PIN terminal)
         │     ├── My Schedule (View shifts)
         │     ├── My Punches (View history)
         │     ├── Availability (Submit weekly)
         │     └── Shift Schedule (View all)
         │
         ├── Worker Dashboard
         │     ├── My Schedule (View shifts)
         │     ├── My Punches (View history)
         │     ├── Availability (Submit weekly)
         │     └── Shift Schedule (View all)
         │
         └── Account Settings (All roles)
               ├── Profile Picture Upload
               ├── Edit Name
               └── Change Password
```
