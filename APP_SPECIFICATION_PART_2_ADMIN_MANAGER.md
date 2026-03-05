# Shift Planner — Application Specification
## Part 2: Admin & Manager Screens (Sections 5.1–5.11)

> **Document Series:**
> - [Part 1: Whole Application Overview](APP_SPECIFICATION_PART_1_OVERVIEW.md)
> - **Part 2 (this file):** Admin & Manager Screens — Login, Admin screens, Manager screens (5.1–5.11)
> - [Part 3: Worker, Kiosk & Shared Screens](APP_SPECIFICATION_PART_3_WORKER_KIOSK.md) — Worker, Shift Leader, Kiosk, Account Settings (5.12–5.19)
> - [Part 4: Data Model, Design System & Business Logic](APP_SPECIFICATION_PART_4_DATA_DESIGN_LOGIC.md) — Data model, design system, business rules, notifications, accessibility

---

## Table of Contents

- [5.1 Login Screen](#51-login-screen)
- [5.2 Admin Dashboard](#52-admin-dashboard)
- [5.3 Admin — Organizations](#53-admin--organizations)
- [5.4 Admin — Locations](#54-admin--locations)
- [5.5 Admin — Managers](#55-admin--managers)
- [5.6 Manager Dashboard](#56-manager-dashboard)
- [5.7 Manager — Workers](#57-manager--workers)
- [5.8 Manager — Schedule Builder](#58-manager--schedule-builder)
- [5.9 Manager — Punch Approvals](#59-manager--punch-approvals)
- [5.10 Manager — Exports](#510-manager--exports)
- [5.11 Manager — Location Settings](#511-manager--location-settings)

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
