# Shift Planner — Application Specification
## Part 3: Worker, Kiosk & Shared Screens (Sections 5.12–5.19)

> **Document Series:**
> - [Part 1: Whole Application Overview](APP_SPECIFICATION_PART_1_OVERVIEW.md)
> - [Part 2: Admin & Manager Screens](APP_SPECIFICATION_PART_2_ADMIN_MANAGER.md) — Login, Admin screens, Manager screens (5.1–5.11)
> - **Part 3 (this file):** Worker, Kiosk & Shared Screens — Worker, Shift Leader, Kiosk, Account Settings (5.12–5.19)
> - [Part 4: Data Model, Design System & Business Logic](APP_SPECIFICATION_PART_4_DATA_DESIGN_LOGIC.md) — Data model, design system, business rules, notifications, accessibility

---

## Table of Contents

- [5.12 Worker Dashboard](#512-worker-dashboard)
- [5.13 Worker — My Schedule](#513-worker--my-schedule)
- [5.14 Worker — My Punches](#514-worker--my-punches)
- [5.15 Worker — Availability](#515-worker--availability)
- [5.16 Shift Leader Dashboard](#516-shift-leader-dashboard)
- [5.17 Kiosk Mode](#517-kiosk-mode)
- [5.18 Shift Schedule (Shared)](#518-shift-schedule-shared)
- [5.19 Account Settings](#519-account-settings)

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
- Times are rounded to the nearest 15-minute increment using a 7-minute boundary (e.g., 14:06 → 14:00, 14:08 → 14:15)
- **Early punch-in override:** If the rounded time is before the shift start time, the punch is recorded at the shift start time instead (i.e., shift start time takes priority over rounding)

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
