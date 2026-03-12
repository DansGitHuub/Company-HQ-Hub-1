# Replit Prompt — CompanyHQ Calendar Module

Paste everything below this line into Replit Agent:

---

Build a full Calendar module for CompanyHQ. This is the central scheduling hub for the entire app. It connects to Jobs, Tasks, Equipment, Employees, and Customers — anything with a start and end date/time should be visible and manageable from the Calendar.

---

## PART 1 — DATABASE

Add a `calendar_events` table with these fields:

- id (serial primary key)
- title (text, required)
- description (text, optional)
- event_type (text — values: "job", "shift", "equipment", "task", "company", "personal", "customer")
- start_datetime (timestamp with timezone, required)
- end_datetime (timestamp with timezone, required)
- all_day (boolean, default false)
- location (text, optional)
- created_by (integer, foreign key to users.id)
- assigned_to (integer, foreign key to users.id, optional)
- linked_record_type (text, optional — "job", "equipment", "task", "customer")
- linked_record_id (integer, optional)
- google_event_id (text, optional)
- is_company_event (boolean, default false)
- is_private (boolean, default false)
- recurrence_rule (text, optional)
- created_at (timestamp, default now)
- updated_at (timestamp, default now)

Also add these columns to the users table if not already present:
- google_access_token (text, optional)
- google_refresh_token (text, optional)
- google_calendar_id (text, optional, default "primary")
- google_token_expiry (timestamp, optional)

---

## PART 2 — CALENDAR PAGE

Create a new page at /calendar.

### Layout
- Left sidebar (220px wide):
  - Mini calendar for quick date navigation
  - Filter checkboxes to show/hide each event type with color dot
  - Upcoming events list — next 7 days, title + date + time
  - Connect Google Calendar button (see Part 5)

- Main area:
  - View toggle: Month | Week | Day
  - Date navigation: left arrow, Today button, right arrow, current date range label
  - Calendar grid

### Event type colors
- Job / Work Order: Green #4caf50
- Employee Shift: Blue #2196f3
- Equipment Reservation: Orange #ff9800
- Task: Purple #9c27b0
- Company Event: Gold #c8a96e
- Personal: Gray #757575
- Customer Appointment: Teal #009688

### Calendar library
Use FullCalendar.js from CDN:
https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js
Initialize with views: dayGridMonth, timeGridWeek, timeGridDay.

### Creating events
- Clicking an empty time slot opens Create Event modal with that time pre-filled
- A + button in the top right also opens the modal with today's date

---

## PART 3 — CREATE / EDIT EVENT MODAL

One modal handles both create and edit. Fields:
- Title (text, required)
- Event type (dropdown with color preview dot)
- All day toggle (hides time fields when on)
- Start date + Start time
- End date + End time
- Location (optional)
- Description (textarea, optional)
- Assign to (user picker — Admin and Manager only)
- Link to record (optional) — dropdown: Job | Equipment | Task | Customer, then search for specific record
- Company event toggle (Admin and Manager only)
- Private toggle
- Repeat: None | Daily | Weekly | Bi-weekly | Monthly | Custom

On edit:
- Pre-fill all fields
- Show Delete button with confirm dialog
- Admins and Managers can edit/delete any event
- Employees and Customers can only edit/delete their own

---

## PART 4 — PERMISSIONS

Filter events on the backend by role — never rely on frontend filtering alone:
- Admin: see, create, edit, delete all events
- Manager: see all company events and own. Create/edit/delete company events and own
- Employee: see company events (is_company_event=true) and events assigned to them. Create/edit/delete own personal events only
- Customer: see events linked to their customer record. Create/edit/delete own personal events only

---

## PART 5 — GOOGLE CALENDAR SYNC

### Connect flow
Show Connect Google Calendar button for users who have not connected.

Routes:
- GET /auth/google/calendar — starts OAuth flow
- GET /auth/google/callback — handles callback

Scopes: https://www.googleapis.com/auth/calendar.events
Use GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Replit Secrets.
On success: save access_token, refresh_token, expiry to user record.
Button changes to Google Calendar Connected with Disconnect option.

### Sync behavior (one-way push: CompanyHQ to Google)
- Event created: push to assigned user's Google Calendar. If is_company_event, push to all connected users. Store returned google_event_id.
- Event updated: update Google Calendar event using stored google_event_id
- Event deleted: delete from Google Calendar

### Token refresh
Check token expiry before every Google API call. Use refresh_token to get new access_token if expired. Save updated token to database.

### Sync status
Show at bottom of left sidebar:
- "Last synced: [time]" in gray when working
- "Sync error — reconnect Google Calendar" in red with reconnect button if failed

Never block the user if sync fails. Log error and continue.

---

## PART 6 — CONNECTIONS TO OTHER MODULES

### Jobs
- When a Job gets a scheduled_date: auto-create calendar_event type "job" linked to that job
- Job date changes: update the event. Job deleted: delete the event
- Job detail page: add Schedule tab showing events linked to that job

### Tasks
- When a Task gets a due_date and assigned user: auto-create calendar_event type "task"
- Task detail page: show linked calendar event date

### Equipment
- When Equipment is reserved with start/end dates: auto-create calendar_event type "equipment"
- Equipment detail page: add Reservations tab showing calendar

### Employees
- Employee detail page: add Schedule tab showing assigned shifts and tasks in weekly view

### Customers
- Customer detail page: add Appointments tab showing events linked to their record

### Dashboard
- Add Upcoming widget showing next 5 events for the logged-in user

---

## PART 7 — NAVIGATION

Add Calendar to the main sidebar navigation:
- Place it alongside Jobs, Tasks, and Employees
- Use a calendar icon
- All roles can see it — backend filters what each user sees

---

## PART 8 — TECHNICAL NOTES

- All timestamps stored in UTC, displayed in user's local timezone
- Mobile responsive — week and day views scroll horizontally on small screens
- Use the same styling as the rest of CompanyHQ
- Do not modify any existing modules except to add the tab/widget connections in Part 6
- All new API routes under /api/calendar/
- Use existing auth middleware for all routes
