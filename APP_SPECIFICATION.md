# Shift Planner — Full Application Specification

> **Purpose of this document:** This is a complete specification for rebuilding the Shift Planner web application as a native mobile app for iOS (Apple) and Android. It covers every screen, feature, interaction, data model, and style detail needed to recreate the app.

---

## Table of Contents

1. [App Overview](#1-app-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Authentication](#3-authentication)
4. [Navigation Structure](#4-navigation-structure)
5. [Screens & Features](#5-screens--features)
   - [Login Screen](#51-login-screen)
   - [Admin Dashboard](#52-admin-dashboard)
   - [Admin — Organizations](#53-admin--organizations)
   - [Admin — Locations](#54-admin--locations)
   - [Admin — Managers](#55-admin--managers)
   - [Manager Dashboard](#56-manager-dashboard)
   - [Manager — Workers](#57-manager--workers)
   - [Manager — Schedule Builder](#58-manager--schedule-builder)
   - [Manager — Punch Approvals](#59-manager--punch-approvals)
   - [Manager — Exports](#510-manager--exports)
   - [Manager — Location Settings](#511-manager--location-settings)
   - [Worker Dashboard](#512-worker-dashboard)
   - [Worker — My Schedule](#513-worker--my-schedule)
   - [Worker — My Punches](#514-worker--my-punches)
   - [Worker — Availability](#515-worker--availability)
   - [Shift Leader Dashboard](#516-shift-leader-dashboard)
   - [Kiosk Mode](#517-kiosk-mode)
   - [Shift Schedule (Shared)](#518-shift-schedule-shared)
   - [Account Settings](#519-account-settings)
6. [Data Model](#6-data-model)
7. [Design System & Styling](#7-design-system--styling)
8. [Business Logic & Rules](#8-business-logic--rules)
9. [Notifications & Feedback](#9-notifications--feedback)
10. [Accessibility & Responsiveness](#10-accessibility--responsiveness)

---

## 1. App Overview

**Shift Planner** (branded as "Spike's Planner") is a multi-role workforce scheduling and time-tracking application. It is designed for organizations with multiple locations that need to manage employee shifts, availability, and punch-clock (time tracking) operations.

### Core Capabilities

- **Shift Scheduling** — Managers create and publish weekly shift schedules for workers across multiple locations.
- **Availability Management** — Workers submit their weekly availability with presets (All Day, Until 16:00, From 17:00, Custom, Unavailable). Managers use this data to build schedules.
- **Punch Clock / Time Tracking** — Workers clock in and out via a PIN-based kiosk terminal or through the app. Managers review and approve time punches.
- **Multi-Location Support** — Organizations can have multiple locations, each with independent settings, schedules, and worker assignments.
- **Role-Based Access** — Five roles (Admin, Manager, Shift Leader, Worker, Kiosk) with distinct dashboards and permissions.
- **Payroll Exports** — CSV exports of approved time punches filtered by month and worker for payroll integration.
- **Account Management** — Profile pictures, password changes, and name updates.

---

## 2. User Roles & Permissions

| Role | Description | Access |
|------|-------------|--------|
| **Admin** | System-wide administrator | Manage organizations, locations, and manager accounts |
| **Manager** | Location manager | Manage workers, build schedules, approve punches, export reports, configure location settings, access kiosk |
| **Shift Leader** | Senior worker | Access kiosk mode for punching workers in/out, plus all worker features |
| **Worker** | Regular employee | View personal schedule, submit availability, view punch history |
| **Kiosk** | Device-only account | Dedicated account for kiosk terminals (no dashboard, auto-enters kiosk mode) |

### Role Hierarchy

- Admin → can create and manage Managers
- Manager → can create and manage Workers and Shift Leaders within their locations
- Shift Leader → Worker permissions + Kiosk access
- Worker → personal schedule, punches, availability only
- Kiosk → locked to kiosk PIN entry mode

---

## 3. Authentication

### Login Flow

1. User enters **username** and **password**.
2. System looks up the email address associated with the username via a backend function.
3. If found, authenticates with email + password.
4. On success, fetches the user's profile and role.
5. Redirects to the appropriate dashboard based on role.

### Session Management

- Persistent sessions with automatic refresh.
- Session refreshes when the app returns to foreground (tab/app visibility change).
- Auth state is globally available throughout the app.

### Security

- Generic error message on failed login: "Invalid username or password" (no username enumeration).
- Role-based route protection — unauthorized users are redirected to login.
- Row-Level Security (RLS) on all database tables — users can only access data they are authorized to see.

---

## 4. Navigation Structure

### Mobile Navigation

- **Bottom tab bar** (fixed at bottom, respects safe areas for notched devices)
- Role-specific tabs with icons and short labels
- Active tab highlighted with primary color

### Desktop / Tablet Navigation

- **Collapsible sidebar** on the left
  - Expanded: 256px wide with icons + labels
  - Collapsed: 64px wide with icons only
  - Toggle button to expand/collapse
- Dark-themed sidebar (dark navy background, light text)
- Logo badge + app name at top
- User profile section at bottom with avatar, account link, and sign-out button

### Navigation Items by Role

**Admin:**
| Icon | Label | Destination |
|------|-------|-------------|
| LayoutDashboard | Dashboard | Admin Dashboard |
| Building2 | Organizations | Organization management |
| MapPin | Locations | Location management |
| UserCog | Managers | Manager management |

**Manager:**
| Icon | Label | Destination |
|------|-------|-------------|
| LayoutDashboard | Dashboard | Manager Dashboard |
| Users | Workers | Worker management |
| CheckSquare | Approvals | Punch approvals |
| Calendar | Schedule Builder | Schedule builder |
| FileText | Exports | Payroll exports |
| ClipboardList | Shift Schedule | View all shifts |
| Monitor | Kiosk | Kiosk mode |
| Settings | Settings | Location settings |

**Shift Leader:**
| Icon | Label | Destination |
|------|-------|-------------|
| LayoutDashboard | Dashboard | Shift Leader Dashboard |
| Monitor | Kiosk | Kiosk mode |
| Calendar | My Schedule | Personal schedule |
| Clock | My Punches | Punch history |
| ClipboardList | Availability | Availability form |
| CalendarDays | Shift Schedule | View all shifts |

**Worker:**
| Icon | Label | Destination |
|------|-------|-------------|
| LayoutDashboard | Dashboard | Worker Dashboard |
| Calendar | My Schedule | Personal schedule |
| Clock | My Punches | Punch history |
| ClipboardList | Availability | Availability form |
| CalendarDays | Shift Schedule | View all shifts |

---

## 5. Screens & Features

### 5.1 Login Screen

**Layout:** Centered card on full-screen background, max width 448px.

**Components:**
- **App icon** — Calendar icon in a blue circular badge at the top of the card
- **Title** — "Spike's Planner" in large bold text
- **Subtitle** — "Sign in to your account" in muted text
- **Username field** — Text input, placeholder "your username", autocomplete enabled
- **Password field** — Password input, placeholder "••••••••", autocomplete enabled
- **Sign In button** — Full-width, primary blue color. Shows "Signing in..." with loading indicator when authenticating
- **Error banner** — Red/destructive background, shown above the form on failed login

---

### 5.2 Admin Dashboard

**Stats Section (top, 3 columns):**

| Stat | Icon | Color | Data Source |
|------|------|-------|-------------|
| Organizations | Building2 | Blue | Count of all organizations |
| Locations | MapPin | Green | Count of all locations |
| Managers | UserCog | Purple | Count of users with manager role |

**Quick Access Grid (3 columns):**
- 🏢 Organizations → Organizations page
- 📍 Locations → Locations page
- 👥 Managers → Managers page

Each card is a tappable link with emoji icon and label text, using the stat-card style (border, shadow, hover effect).

---

### 5.3 Admin — Organizations

**Functionality:**
- List all organizations with name and creation date
- Create new organization (name input + submit)
- Edit organization name
- Delete organization (with confirmation dialog)

**List Item Display:**
- Organization name (bold)
- Created date
- Edit and Delete action buttons

---

### 5.4 Admin — Locations

**Functionality:**
- List all locations grouped by organization
- Create new location: name, organization (dropdown), timezone (dropdown)
- Edit location details
- Delete location (with confirmation)

**List Item Display:**
- Location name (bold)
- Organization name
- Timezone
- Edit and Delete action buttons

---

### 5.5 Admin — Managers

**Functionality:**
- List all manager accounts with profile details
- Create new manager: full name, username, password, organization assignment
- Edit manager profile
- Deactivate/reactivate manager accounts

**List Item Display:**
- Profile picture (or initials avatar)
- Full name
- Username
- Organization
- Active/Inactive status badge
- Edit button

---

### 5.6 Manager Dashboard

**Stats Section (top, 2 columns):**

| Stat | Icon | Color | Data Source |
|------|------|-------|-------------|
| Total Workers | Users | Blue | Count of active workers at manager's locations |
| Clocked In Today | Clock | Green | Count of workers with active punches (no punch_out) today |

**Quick Access Grid (responsive, up to 3 columns):**
- 👥 Workers
- ✅ Punch Approvals
- 📅 Schedule Builder
- 📊 Exports
- ⚙️ Settings
- 📆 Shift Schedule
- 🖥️ Kiosk

Each card links to the respective management page.

---

### 5.7 Manager — Workers

**Worker List:**
- Searchable list of all workers at manager's locations
- Each item shows: profile picture (or initials), full name, username, location, role badge, active status
- Tap to view/edit

**Create Worker Form:**
- Full name (required)
- Username (required, unique)
- Password (required, min 6 chars)
- Phone number (optional)
- Location assignment (dropdown of manager's locations)
- Role (dropdown: Worker or Shift Leader)

**Edit Worker:**
- Same fields as create (except password — separate change password option)
- Toggle active/inactive status
- Reassign location

**Worker Deactivation:**
- Soft delete — marks worker as inactive
- Inactive workers hidden from schedule builder and availability
- Can be reactivated

---

### 5.8 Manager — Schedule Builder

This is the most complex screen in the application.

**Header Controls:**
- **Week selector** — Left/right arrow buttons to navigate weeks, displays "Mon DD – Sun DD Mon YYYY" format
- **Location dropdown** — Select which location to manage (for multi-location managers)
- **View toggle** — Switch between Card View (grid) and Table View
- **Publish button** — Appears when there are unpublished shifts; publishes all shifts for the week

**Card View (Default):**

A grid layout where:
- **Columns** = Days of the week (Monday through Sunday), each showing the date
- **Rows** = Workers assigned to the selected location
- **Cells** = Shift entries for that worker on that day

**Cell States:**

1. **Empty cell** — No shift or availability. Shows "+" button to add a shift.
2. **Availability indicator (yellow box)** — Worker submitted availability but no shift created yet.
   - Displays the availability preset or custom time range (e.g., "All Day", "From 13:00", "14:00–20:00")
   - Contains inline start/end time inputs for quick shift creation
   - "Save" button to create shift from availability
   - "X" button to dismiss/ignore the availability
3. **Shift card (blue/primary)** — Created shift showing start–end times (e.g., "14:00 – 22:00")
   - Tappable to edit times inline
   - "X" button to delete
   - Standby indicator if shift is standby

**Table View:**
- Spreadsheet-style grid with the same data
- More compact, showing times in cells
- Inline editing of start and end times

**Add Shift Modal:**
- Worker name (read-only, auto-filled)
- Date (read-only, auto-filled)
- Start time dropdown (time slots based on location settings, e.g., 30-minute increments)
- End time dropdown (optional)
- Standby checkbox
- Save and Cancel buttons

**Publish Workflow:**
1. Manager reviews all shifts for the week
2. Taps "Publish" button
3. All shifts for the week are marked as published
4. Toast notification confirms publication

**Drag and Drop:**
- Shifts can be dragged between days for the same worker
- Visual feedback during drag operations

---

### 5.9 Manager — Punch Approvals

**Functionality:**
- List of all unapproved time punches from workers at manager's locations
- Filter by location
- Each punch entry shows:
  - Worker name and profile picture
  - Date
  - Punch in time
  - Punch out time (if completed)
  - Calculated hours
  - Location
  - Notes (if any)
- **Approve button** (green/success) — marks punch as approved
- **Reject/Delete button** (red/destructive) — removes the punch
- Bulk actions available

---

### 5.10 Manager — Exports

**Controls:**
- **Month selector** — Dropdown of 12 months, defaults to current month
- **Worker selector** — "All Workers" option or individual worker selection
- **Export CSV button** — Generates and downloads the report

**All Workers Report (CSV format):**
```
Worker,Total Hours
John Doe,40.50
Jane Smith,38.25
TOTAL,78.75
```

**Individual Worker Report (CSV format):**
```
Worker,Date,Clock In,Clock Out,Hours,Location
Jane Smith,15/01/2024,08:00,16:30,8.50,Downtown
Jane Smith,16/01/2024,08:15,16:45,8.50,Downtown
Summary
Total Hours,17.00
```

**Rules:**
- Only approved punches are included in exports
- Date range: first to last day of the selected month
- Location filtering: limited to manager's assigned locations
- File naming: `punches_YYYY-MM.csv` or `punches_YYYY-MM_WorkerName.csv`

---

### 5.11 Manager — Location Settings

**Configurable per location:**

| Setting | Description | Example |
|---------|-------------|---------|
| Time entry mode | How times are entered (dropdown, free text) | Dropdown |
| Time increment | Granularity of time slots (minutes) | 15 or 30 minutes |
| Earliest shift start | Earliest selectable shift start time | 11:30 |
| Latest shift end | Latest selectable shift end time | 23:00 |
| Breaks enabled | Whether break tracking is active | Yes/No toggle |
| Availability deadline day | Day of week when availability submissions lock | Wednesday |
| Availability deadline time | Time on deadline day when submissions lock | 18:00 |

**Additional availability time range settings:**
- Availability "from" start/end — defines selectable range for "From X:00" presets
- Availability "to" start/end — defines selectable range for "Until X:00" presets

---

### 5.12 Worker Dashboard

**Layout:** Simple grid of 4 tappable cards.

| Emoji | Label | Destination |
|-------|-------|-------------|
| 📅 | My Schedule | Personal shift schedule |
| 🕒 | My Punches | Punch/time tracking history |
| 📋 | Availability | Weekly availability form |
| 📆 | Shift Schedule | Company-wide shift view |

Cards use the stat-card style with centered text and hover transitions.

---

### 5.13 Worker — My Schedule

**Layout:**
- Week navigation (left/right arrows with date range display)
- Location selector dropdown

**Schedule Display:**
- List of shifts for the selected week
- Each shift shows:
  - Day name and date
  - Start time – End time
  - Location name
  - Standby indicator (if applicable)
  - Published/Draft status

**Empty State:**
- "No shifts scheduled this week" message

---

### 5.14 Worker — My Punches

**Layout:**
- Date/period filter
- List of punch records

**Each Punch Entry Shows:**
- Date
- Punch in time
- Punch out time (or "Active" if still clocked in)
- Total hours worked
- Approval status badge (Approved ✓, Pending ⏳)
- Location name

---

### 5.15 Worker — Availability

**Layout:**
- **Week navigation** — Left/right arrow buttons with week date range display
- **Location selector** — Dropdown stored in local storage for persistence
- **Weekly grid** — 7 rows, one for each day (Monday through Sunday)

**Each Day Row Contains:**
- Day name + date (e.g., "Mon 8 Jan")
- Preset selector (dropdown or segmented control)
- Custom time inputs (shown only when "Custom" preset is selected)

**Available Presets:**

| Preset | Display Label | Behavior |
|--------|---------------|----------|
| ALL_DAY | All Day | Available the entire day |
| UNTIL_16:00 | Until 16:00 | Available from opening until 16:00 |
| UNTIL_17:00 | Until 17:00 | Available from opening until 17:00 |
| FROM_13:00 | From 13:00 | Available from 13:00 until closing |
| FROM_14:00 | From 14:00 | Available from 14:00 until closing |
| FROM_15:00 | From 15:00 | Available from 15:00 until closing |
| FROM_16:00 | From 16:00 | Available from 16:00 until closing |
| FROM_17:00 | From 17:00 | Available from 17:00 until closing |
| UNAVAILABLE | Unavailable | Not available this day |
| CUSTOM | Custom | User sets specific start and end times |

**Custom Time Inputs:**
- Start time dropdown (30-minute increments within configured range)
- End time dropdown (30-minute increments within configured range)

**Actions:**
- **Submit button** — Saves the full week of availability to the database
- **Template save** — Save current availability as a reusable template
- **Template load** — Apply a previously saved template

**States:**
- **Locked** — If the availability deadline has passed or the manager locked availability, the form is read-only with a lock indicator
- **Past week** — Cannot edit availability for weeks that have already passed
- **Current/future weeks** — Fully editable

---

### 5.16 Shift Leader Dashboard

**Layout:** Grid of 5 tappable cards.

| Emoji | Label | Destination |
|-------|-------|-------------|
| 🖥️ | Kiosk | Kiosk punch clock mode |
| 📅 | My Schedule | Personal schedule |
| 🕒 | My Punches | Punch history |
| 📋 | Availability | Availability form |
| 📆 | Shift Schedule | Company-wide shift view |

---

### 5.17 Kiosk Mode

The kiosk mode is a fullscreen PIN-based punch clock terminal designed for shared devices (e.g., a tablet at the entrance).

**Step 1 — Setup Screen:**
- Location selector dropdown (required)
- "Enter Kiosk Mode" button

**Step 2 — PIN Entry Screen (Fullscreen):**

**Display:**
- App title at top
- 5 circles showing PIN entry progress (empty circles fill with stars ★ as digits are entered)
- Error/status messages below the circles
- Numeric keypad (calculator-style layout)

**Keypad Layout:**
```
[ 1 ] [ 2 ] [ 3 ]
[ 4 ] [ 5 ] [ 6 ]
[ 7 ] [ 8 ] [ 9 ]
[CLR] [ 0 ] [ ⌫ ]
```

- CLR = Clear all digits
- ⌫ = Backspace (delete last digit)
- Auto-submits when 5th digit is entered

**Step 3 — Worker Info Card (after successful PIN lookup):**

**Displays:**
- Worker profile picture (large, circular) or initials avatar if no picture
- Worker full name (large, bold)
- Today's shift box (blue background): "HH:MM – HH:MM" or "No shift scheduled today"
- Current status message:
  - "Not clocked in yet"
  - "Clocked in since HH:MM"
  - "Shift already completed today ✓"

**Action Buttons:**
- **Clock In** (primary/blue) — shown when worker has no active punch today
- **Clock Out** (destructive/red) — shown when worker has an active punch
- **Cancel** — returns to PIN entry without action
- **OK** — shown when shift is completed, returns to PIN entry

**Step 4 — Feedback Banner:**
- **Success** — Green background with checkmark icon and message (e.g., "Clocked in at 14:00")
- **Error** — Red background with X icon and error message
- Auto-dismisses after 2.5 seconds, returns to PIN entry

**Security Features:**
- **Rate limiting** — 5 failed PIN attempts triggers a 60-second lockout with countdown timer
- **Brute-force protection** — 1.5-second delay on failed attempts
- **Exit protection** — Exiting kiosk mode requires entering the manager/shift leader password via a confirmation dialog
- Kiosk-role accounts fully sign out when exiting

**Time Rounding Rules (Clock In):**
- Quarter-hour rounding with a 7-minute boundary
- If punching in early (before shift start), the punch is recorded at the shift start time
- Times are rounded to the nearest 15-minute increment

---

### 5.18 Shift Schedule (Shared)

Accessible to all authenticated users. Shows the schedule for all workers at a location.

**Layout:**
- **View toggle** — Day view or Week view
- **Date/week navigation** — Left/right arrows with swipe gesture support
- **Location selector** — Dropdown

**Day View:**
- List of all shifts for the selected day
- Each shift shows: worker name, start–end times, standby status

**Week View:**
- Grid layout: columns = days (Mon–Sun), rows = workers
- Each cell shows the shift time range or empty state

**Swipe Gestures:**
- Swipe left = next day/week
- Swipe right = previous day/week

---

### 5.19 Account Settings

**Profile Section:**
- Profile picture with upload/change option (circular preview)
- Full name (editable text input)
- Save button

**Security Section:**
- Change password form:
  - New password input
  - Confirm password input
  - Update button
- Password must match confirmation

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
├── unique_key (text, 5-digit PIN for kiosk)
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
├── preset (text: ALL_DAY, UNTIL_16:00, FROM_13:00, CUSTOM, UNAVAILABLE, etc.)
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
