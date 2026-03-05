# Shift Planner — Application Specification
## Part 1: Whole Application Overview

> **Purpose of this document:** This part is the complete high-level overview of the Shift Planner application. It covers every major area — roles, authentication, navigation, screens, data, design, and business rules — at a summary level. Subsequent parts (2, 3, and 4) expand each area with full implementation detail.
>
> **Document Series:**
> - **Part 1 (this file):** Whole application overview
> - [Part 2: Admin & Manager Screens](APP_SPECIFICATION_PART_2_ADMIN_MANAGER.md) — Login, Admin screens, Manager screens (5.1–5.11)
> - [Part 3: Worker, Kiosk & Shared Screens](APP_SPECIFICATION_PART_3_WORKER_KIOSK.md) — Worker, Shift Leader, Kiosk, Account Settings (5.12–5.19)
> - [Part 4: Data Model, Design System & Business Logic](APP_SPECIFICATION_PART_4_DATA_DESIGN_LOGIC.md) — Data model, design system, business rules, notifications, accessibility

---

## Table of Contents

1. [App Overview](#1-app-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Authentication](#3-authentication)
4. [Navigation Structure](#4-navigation-structure)
5. [Screens Summary](#5-screens-summary)
6. [Data Model Summary](#6-data-model-summary)
7. [Design System Summary](#7-design-system-summary)
8. [Business Logic Summary](#8-business-logic-summary)

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

## 5. Screens Summary

The app contains 19 screens grouped by role. Full detail is in Parts 2 and 3.

### 5.1 Login Screen
Centered card (max 448px wide) with username and password inputs, a "Sign In" button, and a loading indicator. On failure, a red error banner is displayed above the form. On success, users are redirected by role.

### 5.2 Admin Dashboard
Shows three stat cards (Organizations, Locations, Managers count) and a 3-column quick-access grid linking to each admin management page.

### 5.3 Admin — Organizations
Full CRUD interface: list all organizations with name and creation date; create, edit, and delete (with confirmation) organizations.

### 5.4 Admin — Locations
Full CRUD interface: list locations grouped by organization; create with name, organization, and timezone selectors; edit and delete (with confirmation).

### 5.5 Admin — Managers
Full CRUD interface: list manager accounts with profile picture, name, username, organization, and active status; create, edit, and deactivate/reactivate manager accounts.

### 5.6 Manager Dashboard
Shows two stat cards (Total Workers, Clocked In Today) and a responsive quick-access grid with links to Workers, Approvals, Schedule Builder, Exports, Settings, Shift Schedule, and Kiosk.

### 5.7 Manager — Workers
Searchable worker list with create/edit/deactivate functionality. Worker form captures full name, username, password, phone, location, and role (Worker or Shift Leader).

### 5.8 Manager — Schedule Builder
The most complex screen. A weekly grid (workers × days) showing availability indicators (yellow) and shift cards (blue). Supports inline time editing, add/edit/delete shifts, drag-and-drop between days, and a Publish workflow to release shifts to workers.

### 5.9 Manager — Punch Approvals
Lists all unapproved time punches for the manager's locations. Each entry shows worker, date, punch-in/out times, calculated hours, location, and notes. Managers approve (green) or reject/delete (red) punches individually or in bulk.

### 5.10 Manager — Exports
CSV payroll export tool. Managers select a month and optionally a specific worker, then download a report. "All Workers" reports show total hours per worker; individual reports show detailed punch records with dates, times, hours, and location.

### 5.11 Manager — Location Settings
Per-location configuration: time entry mode (dropdown or free text), time increment (15 or 30 min), earliest shift start, latest shift end, breaks toggle, availability deadline day and time, and availability time range presets.

### 5.12 Worker Dashboard
Simple grid of four tappable cards: My Schedule, My Punches, Availability, and Shift Schedule.

### 5.13 Worker — My Schedule
Week navigation with a list of the worker's shifts for the selected week. Each shift shows day, date, start/end times, location, standby flag, and published/draft status.

### 5.14 Worker — My Punches
List of the worker's punch records with date, clock-in, clock-out (or "Active"), total hours, approval status badge, and location name.

### 5.15 Worker — Availability
Weekly availability form (Monday–Sunday) with preset selectors (All Day, Until 16:00, From 13:00, Custom, Unavailable) and custom time inputs. Supports saving/loading availability templates. Form locks after the manager-configured deadline or when locked by the manager.

### 5.16 Shift Leader Dashboard
Grid of five cards: Kiosk, My Schedule, My Punches, Availability, and Shift Schedule. Shift leaders have worker-level access plus kiosk access.

### 5.17 Kiosk Mode
Fullscreen PIN-based punch clock terminal for shared devices. Workers enter their 5-digit PIN on a calculator-style keypad. The system displays the worker's name, today's shift, and current status (not clocked in / clocked in since / completed). Clock In / Clock Out / Cancel buttons appear contextually. Failed PIN attempts trigger a 60-second lockout after 5 tries. Exiting kiosk requires manager password verification.

### 5.18 Shift Schedule (Shared)
Available to all authenticated users. Shows shifts for all workers at a selected location in Day view (shift list) or Week view (grid). Supports left/right navigation and swipe gestures.

### 5.19 Account Settings
Profile section: upload profile picture, edit full name, save. Security section: change password with new password + confirm password inputs.

---

## 6. Data Model Summary

The database is built on Supabase (PostgreSQL) with Row-Level Security. Key tables:

| Table | Purpose |
|-------|---------|
| `organizations` | Top-level tenant groupings |
| `locations` | Physical locations within an organization |
| `profiles` | User profile data including 5-digit kiosk PIN |
| `user_roles` | Role assignment per user (admin, manager, shiftleader, worker, kiosk) |
| `user_locations` | Many-to-many: which workers belong to which locations |
| `shifts` | Individual shift records (user, date, start/end, location, published, standby) |
| `time_punches` | Clock-in/out records with approval workflow |
| `availability` | Per-user, per-week, per-day, per-location availability submissions |
| `availability_exceptions` | One-off date-specific availability overrides |
| `availability_templates` | Saved availability patterns (JSON entries) |
| `location_settings` | Per-location configuration for scheduling and availability |
| `kiosk_accounts` | Dedicated kiosk device accounts per location |

Full schema with columns and relationships is in [Part 4](APP_SPECIFICATION_PART_4_DATA_DESIGN_LOGIC.md).

---

## 7. Design System Summary

The app uses **Inter** as the primary font and **JetBrains Mono** for codes and PINs. The color system supports both light and dark modes with a blue primary (`#3B82F6`), green success, red destructive, and yellow warning palette.

Key component styles:
- **Stat cards** — White background, 1px border, 12px radius, subtle shadow, hover lift effect
- **Buttons** — Primary (blue), Destructive (red), Outline, Ghost variants; 200ms transitions
- **Input fields** — Full-width, 12px radius, primary-colored focus ring
- **Badges** — Color-coded pills for role labels, approval status, and shift status
- **Toast notifications** — Slide-in, auto-dismiss after 3–5 seconds; success/error/info/warning types
- **Sidebar** — Always dark-themed (dark navy) regardless of light/dark mode

Full design tokens, typography scale, spacing values, and animation timings are in [Part 4](APP_SPECIFICATION_PART_4_DATA_DESIGN_LOGIC.md).

---

## 8. Business Logic Summary

Key rules governing the application:

- **Shifts** start as draft (unpublished) and must be explicitly published to become visible to workers. Time slots are constrained by location settings.
- **Availability** can be locked by the manager or auto-locked after a configured weekly deadline. Past weeks cannot be edited.
- **Time punches** are rounded to the nearest 15-minute increment using a 7-minute boundary. Punching in before a shift start records the punch at the shift start time instead. Only manager-approved punches appear in exports.
- **Kiosk** uses a 5-digit PIN per worker. Rate limiting (5 failed attempts → 60-second lockout) and a 1.5-second delay on failed attempts protect against brute force. Exiting kiosk mode requires password verification.
- **Exports** are CSV files filtered by month and optionally by worker, containing only approved punch records.

Full business logic rules, notification messages, and accessibility requirements are in [Part 4](APP_SPECIFICATION_PART_4_DATA_DESIGN_LOGIC.md).
