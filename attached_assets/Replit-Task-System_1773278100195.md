# Replit Prompt — CompanyHQ Task / To-Do System

Paste everything below this line into Replit Agent:

---

Build a Task / To-Do System for CompanyHQ. This is an internal-only tool for tracking one-off tasks across the company. Tasks can be assigned to a specific person or sit in an open unassigned pool. This is NOT a recurring system — each task is a standalone item.

---

## PART 1 — DATABASE

Create a `tasks` table with these fields:

- id (serial primary key)
- title (text, required)
- description (text, optional)
- status (text — values: "todo", "in_progress", "waiting", "complete", "cancelled", default "todo")
- priority (text — values: "low", "medium", "high", "urgent", default "medium")
- assigned_to (integer, foreign key to users.id, optional — null means unassigned/open pool)
- created_by (integer, foreign key to users.id, required)
- due_date (date, optional)
- start_date (date, optional)
- time_estimate (integer, optional — stored in minutes)
- linked_record_type (text, optional — "job" or "customer")
- linked_record_id (integer, optional)
- reminder_date (timestamp, optional)
- reminder_sent (boolean, default false)
- completed_at (timestamp, optional)
- cancelled_at (timestamp, optional)
- created_at (timestamp, default now)
- updated_at (timestamp, default now)

Create a `task_comments` table:
- id (serial primary key)
- task_id (integer, foreign key to tasks.id, cascade delete)
- user_id (integer, foreign key to users.id)
- body (text, required)
- created_at (timestamp, default now)
- updated_at (timestamp, default now)

Create a `task_attachments` table:
- id (serial primary key)
- task_id (integer, foreign key to tasks.id, cascade delete)
- uploaded_by (integer, foreign key to users.id)
- filename (text)
- file_url (text)
- file_type (text)
- file_size (integer)
- created_at (timestamp, default now)

Create a `task_custom_fields` table:
- id (serial primary key)
- task_id (integer, foreign key to tasks.id, cascade delete)
- field_name (text, required)
- field_value (text, optional)
- created_at (timestamp, default now)

---

## PART 2 — TASKS PAGE

Create a new page at /tasks with two main sections side by side or toggled by tab:

### Section A — My Tasks / Assigned Tasks
Shows tasks assigned to the currently logged-in user. Organized in columns by status:
- To Do
- In Progress
- Waiting on Someone
- Complete (collapsed by default, expandable)
- Cancelled (collapsed by default, expandable)

Each task card in the column shows:
- Title
- Priority badge (color coded: low=gray, medium=blue, high=orange, urgent=red)
- Due date (red if overdue, orange if due today, gray if future)
- Assigned to avatar/name (or "Unassigned" if open pool)
- Linked record if any (job name or customer name as a small tag)
- Comment count if any comments exist
- Attachment count if any attachments exist

Cards are draggable between status columns (drag and drop to change status).

### Section B — Open Pool
A separate section showing all tasks where assigned_to is null. Title: "Open Tasks — Available to Anyone".
- Anyone can pick up an open task by clicking "Assign to Me"
- Managers and Admins can assign open tasks to specific people
- Same card format as Section A

### View toggles
At the top of the page add toggle buttons:
- **Board** (default) — kanban column view described above
- **List** — flat sortable list of all tasks the user can see, with columns: Title, Priority, Status, Assigned To, Due Date, Linked To
- **My Tasks** — filtered board showing only tasks assigned to the logged-in user

### Filters bar
Above the board add filter controls:
- Search (text search on title and description)
- Filter by priority (All / Low / Medium / High / Urgent)
- Filter by assigned person (Admin and Manager only)
- Filter by due date (All / Overdue / Due Today / Due This Week / No Due Date)
- Filter by linked record type (All / Jobs / Customers / Unlinked)
- Sort by (Due Date / Priority / Created Date / Last Updated)

---

## PART 3 — CREATE / EDIT TASK MODAL

One modal handles both create and edit. Fields:

**Core fields:**
- Title (text, required)
- Description (textarea, optional — supports plain text with line breaks)
- Status (dropdown: To Do / In Progress / Waiting on Someone / Complete / Cancelled)
- Priority (dropdown with color dot: Low / Medium / High / Urgent)

**Scheduling:**
- Start date (date picker, optional)
- Due date (date picker, optional)
- Time estimate (number input + unit selector: minutes / hours / days)
- Reminder (date + time picker, optional — sends a notification before the due date)

**Assignment (Managers and Admins only):**
- Assign to (user search/select dropdown — shows all active employees)
- Leave blank to put in Open Pool

**Links:**
- Link to record (optional) — dropdown: Job | Customer, then search for specific record

**Custom fields:**
- A section labeled "Custom Fields" with an Add Field button
- Each custom field has: Field Name (text input) + Field Value (text input)
- Can add unlimited custom fields
- Each field has a remove (x) button
- Examples: "Vendor", "PO Number", "Reference", "Location", "Truck Number" — user names it whatever they want

**Attachments:**
- File upload area (drag and drop or click to browse)
- Supports PDF, JPG, PNG, DOCX, XLSX up to 25MB
- Shows thumbnails for images, file icons for documents
- Each attachment has a download button and a delete button

**Comments:**
- Comment input at the bottom of the modal (textarea + Post button)
- Comments list above the input, newest at top
- Each comment shows: user avatar, user name, timestamp, comment body
- Comment author can delete their own comment
- Managers and Admins can delete any comment

On edit mode:
- Pre-fill all fields
- Show Delete Task button (red, confirm dialog — Admin and Manager only)
- Show complete timestamp if status is Complete
- Show cancelled timestamp if status is Cancelled

---

## PART 4 — QUICK ADD

At the top of the Tasks page add a Quick Add bar — a single text input with a + button. Typing a task title and pressing Enter or clicking + creates a task instantly with:
- Title: whatever was typed
- Status: To Do
- Priority: Medium
- Assigned to: the logged-in user (or unassigned if preference)
- No other fields — can be edited by clicking the card

---

## PART 5 — PERMISSIONS

- **Admin** — can see all tasks, create tasks, assign to anyone, edit/delete any task
- **Manager** — can see all tasks, create tasks, assign to anyone, edit/delete any task
- **Employee** — can see tasks assigned to them and all open pool tasks. Can create tasks (go to open pool by default or assigned to themselves). Cannot assign to others. Cannot delete tasks created by others
- All roles can add comments and attachments to tasks they can see
- All roles can pick up open pool tasks by assigning to themselves

---

## PART 6 — NOTIFICATIONS AND REMINDERS

### Assignment notifications
When a task is assigned to a user, send them an email notification via SendGrid with:
- Subject: "New task assigned to you: [task title]"
- Body: task title, description, due date, priority, who assigned it, link to the task
- Use the FROM_EMAIL and SENDGRID_API_KEY from Replit Secrets

### Reminder notifications
Create a background job that runs every hour and checks for tasks where:
- reminder_date is in the past
- reminder_sent is false
- status is not complete or cancelled

For each: send an email reminder to the assigned user, set reminder_sent = true

### Due date notifications
Same background job also checks for tasks where:
- due_date is today
- status is not complete or cancelled
- assigned_to is not null

Send a daily due date reminder email at 8am.

### Calendar integration
When a task has a due_date and assigned_to:
- Auto-create a calendar event of type "task" linked to the task (linked_record_type="task", linked_record_id=task.id)
- If due_date changes, update the calendar event
- If task is completed or cancelled, delete the calendar event

---

## PART 7 — CONNECTIONS TO OTHER MODULES

### Jobs
- On the Job detail page add a Tasks tab showing all tasks linked to that job
- From that tab, managers can create a new task pre-linked to the job

### Customers
- On the Customer detail page add a Tasks tab showing all tasks linked to that customer
- From that tab, managers can create a new task pre-linked to the customer

### Dashboard
- Add a My Tasks widget showing the logged-in user's top 5 upcoming tasks by due date
- Show overdue count as a red badge

### Calendar
- Tasks with due dates appear on the Calendar as purple events (already handled in Calendar module — just make sure the auto-create logic in Part 6 fires correctly)

### AI Assistant
- The AI should be able to answer questions like "what tasks do I have today?" and "show me all overdue tasks" using the tasks data

---

## PART 8 — NAVIGATION

Add "Tasks" to the main sidebar navigation:
- Place it alongside Jobs, Calendar, and Employees
- Use a checkbox or checklist icon
- Show a red badge with the count of overdue tasks assigned to the logged-in user
- All roles can see it

---

## PART 9 — TECHNICAL NOTES

- Drag and drop between kanban columns using existing drag-and-drop library in the project, or use @dnd-kit/core if none exists
- All task API routes under /api/tasks/
- File uploads use the existing document/file upload system already in CompanyHQ
- Use existing auth middleware on all routes
- Use the same card, modal, button, and color styling as the rest of CompanyHQ
- Do not modify any existing modules except to add the Tasks tab connections described in Part 7
- Mobile responsive — kanban board scrolls horizontally on small screens, list view stacks cleanly
