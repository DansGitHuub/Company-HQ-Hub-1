# Replit Prompt — CompanyHQ Navigation Cleanup & Layout Restructure

Paste everything below this line into Replit Agent:

---

This is a cleanup and restructure of the CompanyHQ navigation and layout. The goal is to remove duplicate features, consolidate navigation, and simplify the UI without breaking any existing functionality or data connections. Read every instruction carefully before making any changes.

---

## IMPORTANT — READ FIRST

- Do NOT touch the CompanyHQ logo or the Chapin Landscapes company logo anywhere in the app
- Do NOT change any existing database tables, API routes, or data connections
- Do NOT change the visual design or styling of any module that is currently working
- When removing something, check that nothing else depends on it before deleting
- If unsure whether something is safe to remove, hide it instead of deleting it and note what you did

---

## PART 1 — REPLACE OLD CALENDAR WITH NEW CALENDAR IN TOP BAR

There are currently two calendar features:
1. An old calendar icon in the top bar that expands into a dropdown when clicked
2. A new full Calendar module recently installed (currently also in the left nav)

**Action:**
- Replace the old calendar dropdown in the top bar with the new full Calendar module
- When the calendar icon in the top bar is clicked, the new Calendar opens as a full-screen overlay that covers the main content area — same experience as the full Calendar page, just triggered from the top bar
- Add a close button (X) in the top right of the overlay to dismiss it and return to whatever page the user was on
- Remove Calendar from the left nav entirely — it now lives in the top bar icon only
- Do not change any of the new Calendar module's functionality, data, or connections

---

## PART 2 — CONSOLIDATE TASKS / TO DO

There are currently three task-related features:
1. An original To Do List accessible from the left nav — this is the one to KEEP
2. A new floating + button at the bottom of the screen added recently — REMOVE this
3. A new Kanban board Tasks module added recently — REMOVE this

**Action:**
- Keep the existing To Do List in the left nav exactly as it is — do not change its UI, layout, or styling
- Remove the new floating + button from the bottom of the screen
- Remove the new Kanban Tasks module that was recently installed. Before removing, check if it created any new database tables. If it did, note the table names but do not delete the tables yet — just remove the UI and routes
- Rename "To Do List" to "Tasks" in the left nav label only — do not change anything else about it

**Then — check and add missing connections to the existing To Do List:**
- Check if the existing To Do List has a database table. If not, create one called `todos` with: id, title, description, status (todo/in_progress/complete), priority (low/medium/high/urgent), assigned_to (user id), created_by (user id), due_date, reminder_date, reminder_sent, linked_record_type, linked_record_id, created_at, updated_at
- If it already has a table, use whatever exists — do not recreate it
- Check if tasks/todos with due dates currently create Calendar events. If not, add this: when a todo/task is given a due_date and assigned_to, auto-create a calendar_event of type "task" linked to it. If due_date changes, update the event. If task is completed or deleted, remove the event
- Check if the app sends email reminders for tasks. If not, add a background job that checks every hour for todos where reminder_date has passed and reminder_sent is false, then sends a reminder email via SendGrid to the assigned user and sets reminder_sent = true
- Do not change the visual appearance of the To Do List in any of the above

---

## PART 3 — RESTRUCTURE LEFT NAV

Reorganize the left navigation into clean grouped sections. Keep every existing module link — just reorganize where they appear. Do not remove any module from the nav unless explicitly told to above.

The new nav order from top to bottom:

**[Logo and app name at top — do not change]**

**My Workspace** (rename current Dashboard to this — see Part 4)

**WORK**
- Jobs
- Tasks (renamed from To Do List per Part 2)
- Equipment

**PEOPLE**
- Employees
- Customers
- Hiring

**COMPANY**
- Messages
- Documents
- SOP Library
- Compliance

**ADMIN** (visible to Admin and Manager roles only)
- Tools
- Reports
- Settings

Section headers (WORK, PEOPLE, COMPANY, ADMIN) should be small uppercase labels in a muted color, not clickable.

If any existing module doesn't fit neatly into one of these sections, place it in the section that makes the most sense and note where you put it.

---

## PART 4 — RENAME AND SIMPLIFY DASHBOARD

- Rename the current Dashboard page to "My Workspace" in the nav and page title
- Keep all existing widgets and functionality on it exactly as they are
- Remove any tile view, alternate layout toggle, or layout switcher if one exists — keep only the default layout
- Remove the theme switcher UI if one exists — do not change the current theme, just remove the ability to switch themes for now
- Do not add any new widgets or change any existing widget functionality

---

## PART 5 — CLEAN UP TOP BAR

The top bar should contain only these elements:
- App name / logo on the left (do not change)
- Global search in the center or right (keep if exists)
- Notifications bell on the right (keep if exists)
- Help button on the right (keep if exists)
- User avatar / profile menu on the far right (keep if exists)

Remove from the top bar:
- The old calendar dropdown icon (handled in Part 1)
- The old to do / task icon if one exists there
- Any layout or theme switcher icons (handled in Part 4)
- Any other duplicate navigation icons that now have a proper home in the left nav

Do not remove anything from the top bar that isn't listed above.

---

## PART 6 — FLOATING BUTTONS

After cleanup there should be exactly two floating buttons in the bottom right corner:
1. The existing AI Assistant sparkle/star button — keep exactly as is
2. Remove any other floating buttons that were added recently (the new floating + task button)

If there was an original floating to do button that predates the new one, check whether it still serves a purpose. If it duplicates the Tasks nav item, remove it. If it has unique functionality not available elsewhere, keep it and note what it does.

---

## PART 7 — VERIFY NOTHING IS BROKEN

After all changes:
- Click through every item in the left nav and confirm each page loads
- Confirm the new Calendar module still loads and functions
- Confirm the To Do List / Tasks still loads and functions
- Confirm the AI Assistant button still opens the AI panel
- Confirm all existing data is intact
- Report anything that isn't working

---

## SUMMARY OF WHAT CHANGES

- Old calendar dropdown in top bar → REPLACED with new full Calendar module (opens full-screen overlay on click)
- Calendar removed from left nav → now accessed via top bar icon only
- New floating + task button → REMOVED
- New Kanban Tasks module UI and routes → REMOVED
- To Do List → RENAMED to Tasks in nav label only
- Dashboard → RENAMED to My Workspace
- Left nav → REORGANIZED into grouped sections
- Tile view / layout switcher → REMOVED
- Theme switcher UI → REMOVED
- Everything else → UNCHANGED

## SUMMARY OF WHAT DOES NOT CHANGE

- CompanyHQ logo
- Chapin Landscapes company logo
- All database tables and data
- All API routes
- All Calendar module functionality and data connections
- All module functionality and styling
- The existing To Do List UI and styling
- The AI Assistant
- All existing working features
