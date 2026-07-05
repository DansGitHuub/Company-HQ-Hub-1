# Company HQ - Landscape Management Dashboard

## Overview
Company HQ is an all-in-one management dashboard designed for landscape installation and maintenance businesses. Its primary purpose is to centralize and streamline various business operations, including standard operating procedures (SOPs), inventory, hiring, marketing, job tracking, customer education, and employee management. The platform features robust role-based access control to enhance productivity and organization across Admin, Manager, Crew, and Customer roles.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features 8 landscape-inspired themes, utilizing a traditional sidebar navigation for core sections such as My Workspace, Work, People, Company, Admin, and Customer Hub/Resource Library. A consistent design language is applied across all navigation elements, layouts, and interactive components, including strict sizing, styling, padding, button placement, and hover effects. The Admin Panel organizes navigation into People, Content, AI & Tools, and System. The Dashboard ("My Workspace") is a customizable widget-based homepage.

### Technical Implementation
The frontend is built using React and TypeScript, leveraging React Query for server state management and React Context for local state. UI components are sourced from shadcn/ui and Radix UI, styled with Tailwind CSS v4. Animations are handled by Framer Motion, drag-and-drop functionalities by @hello-pangea/dnd, and data visualizations by Recharts. Form management is implemented with React Hook Form and Zod. The backend is developed with Node.js, Express, and TypeScript, providing a RESTful JSON API. Authentication relies on Passport.js local strategy with Express-session and scrypt. Data persistence is managed via PostgreSQL, utilizing Drizzle ORM and drizzle-zod for schema management. Frontend bundling is done with Vite, and backend bundling with esbuild.

### Feature Specifications
- **Role-Based Access Control (RBAC)**: Supports Admin, Manager, Crew, Customer, and Master Admin roles.
- **AI Assistant**: Integrates OpenAI for AI chat with streaming, conversation history, tool library, and full voice capabilities.
- **SOP Management**: Centralized SOPs with AI-powered quiz generation, adaptive quizzes, an AI-powered SOP Pipeline for content generation and scheduling, and an AI Editor for content and image rewriting with version history.
- **Employee Quiz History Tracking**: Records all quiz attempts with detailed results for administrative review and HR decisions.
- **Inventory Management**: Comprehensive materials catalog with an AI-powered creation wizard.
- **Materials Catalog Module**: Full catalog management for Labor, Equipment, Materials, and Subcontracting items. Features auto-generated item numbers (ITEM-000001 format), class/category/tag filtering, cost and taxable tracking, SKU support, CSV bulk import, and soft-delete (retire) workflow. Tables: catalog_items, catalog_tags, catalog_item_tags. Routes: GET/POST/PUT/DELETE /api/catalog, /api/catalog/categories, /api/catalog/tags, /api/catalog/import. Frontend at /catalog and /catalog/import.
- **Vendors Module**: Basic vendor directory (`vendors` table: name, contact name, email, phone, address, category, notes). List page at `/vendors` with search, add/edit/delete. Routes: GET/POST/PUT/DELETE `/api/vendors`.
- **Bulk CSV Import (Employees, Equipment, Vendors)**: Same upload → preview → confirm UX as the Materials Catalog import, built on a shared `CsvImportPage` component. Each import parses the CSV, previews the first 5 rows, then posts to its endpoint which validates rows, dedups against existing records, and reports imported/updated/skipped counts plus per-row errors. Employees dedup by personal email (new hires get onboarding checklists auto-created). Equipment dedups by VIN then serial number (auto-generates asset IDs for new rows). Vendors dedup by name. Routes: `POST /api/employees/import`, `POST /api/fleet/assets/import`, `POST /api/vendors/import`. Frontend at `/employees/import`, `/equipment/import`, `/vendors/import`, reachable via "Import CSV" buttons on the Employees, Equipment, and Vendors list pages.
- **Hiring & HR Module**: Full hiring pipeline with a Kanban board, applicant tracking, employee records, HR email templates, public application forms, interview scheduling (Zoom integration), offer letter management, and digital signature for acceptance. Includes an applicant status portal.
- **Marketing Campaigns**: Database-backed campaign management with CRUD operations, dashboard, and performance visualization.
- **Work Pipeline**: Manages "Sold Jobs" and "Estimates" via Kanban boards.
- **Estimates Module**: A complete sales estimate system with template types, status tracking, detailed list and detail pages, customer interaction, and conversion to jobs.
- **Jobs Module**: Full job lifecycle management including list view with status tabs, search, detail pages with job specifics, time entries, notes, and activity timeline. Jobs list has an "Export" button that downloads the currently filtered/visible jobs as a CSV (client-side, respects the active status tab/search/date filters).
- **Customer Hub / Resource Library**: Centralized educational content for customers with bookmarking capabilities.
- **Employee Management**: Employee Portal for payroll, time off, and personal details, including time off requests, resignation letters, and corrective action reports with two-way digital signing workflows.
- **Equipment / Fleet Management**: Comprehensive fleet management with health dashboards, asset tracking, OEM maintenance library, VIN decoding, and document management.
- **Interactive Calendar**: Full calendar module with multiple views, CRUD operations for events, Google Calendar OAuth sync, team assignment, and search/filtering.
- **My Day (Crew Mobile View)**: Mobile-first page for daily job assignments, clock-in/out functionality, drive time, shop time, and break tracking with live timers and GPS integration.
- **Scheduling / Dispatch Calendar**: Full-screen weekly dispatch board for assigning unscheduled jobs to crews, with division color-coding and time-slot management.
- **Business Rules (Admin)**: Central admin-only settings screen at `/admin/business-rules` for editable business rules grouped by category (Financial, Scheduling, Workflow), each shown as a row with current value, description, and a Save button with positive-number/select validation. Backed by a small additive `business_rules` table (key, label, description, category, value, value_type, options, sort_order, updated_at, updated_by). Seeded rules: late fee percentage, late fee grace period (days), default invoice payment terms (Net 15/30/45), default deposit percentage, minimum scheduling lead time (days), double-booking warning buffer (minutes), and manager approval threshold ($) for estimates/invoices. The double-booking buffer rule is wired live into the crew overlap check (`POST /api/scheduling/check-crew-overlap`), replacing the previous hard-coded 480-minute default; other rules are configuration-only for now. Routes: `GET/PATCH /api/business-rules` (Admin only, 403 for other authenticated roles, 401 unauthenticated). Reachable via the Admin Panel Settings group.
- **Automation Center (Admin)**: Admin-only screen at `/admin/automation-center` for toggling optional background automations, grouped by category (Status Triggers, Reminders & Escalations, Recurring Jobs). All automations default OFF. Backed by an additive `automations` table (key, label, description, category, enabled, config, sort_order, last_run_at, updated_at, updated_by). Automations: (1) job Completed → auto-send the job's single draft invoice; estimate Approved (staff or customer portal) → auto-create a job from the estimate; (2) daily missing-worksheet check — a toggle gate in front of the existing worksheet alert scheduler, no internal logic changed; daily late-fee flagging — flags invoices past the Business Rules grace period for admin review only (in-app notification, never a customer email); (3) recurring job generation — for admin-selected customers, auto-clones their most recent completed job (with work areas/line items) into a new job N days before the prior job's completion date (N configurable per automation). All admin alerts go through `staff_notifications`; no automation ever emails or contacts a real customer directly. Routes: `GET/PATCH /api/automations/:key` (Admin only). Reachable via the Admin Panel Settings group and an Automation Center tile on the Admin home tab.
- **Admin Tools**: A suite of tools including a dynamic Form Builder, Company Branding, Help System, Global Search, Communications Center, Lead Qualifier, Plow Site Mapper, AI Agents System, Update Notification System, Help Articles, Diagnostic Report System, PDF Field Placer, and Property Report Card tool, all accessible via full-screen overlay modals.
- **Time Reports (Admin)**: Admin-only page at `/admin/time-reports` that aggregates all employee clock-in/clock-out records. Features Employee, Job, Customer, Year, and Date Range filters. Displays a table with Employee Name, Date, Clock In, Clock Out, Total Hours, Job, Customer, and Type columns plus a summary footer row and total-hours badge. Includes CSV export. API: `GET /api/admin/time-reports`. Listed in AppShell ADMIN sidebar and AdminPanel Operations group.
- **Task Management System**: Full task system with Kanban board, list view, open pool, quick add, and scheduling.
- **Document Sharing System**: Cross-module document sharing from a central Document Library.
- **Customer Suggestions**: Allows customers to submit improvement suggestions for admin review.
- **Employee Agreement System**: Manages position-based agreement templates with variable placeholders, digital signing workflows, and archived records.
- **Customizable Dashboard**: Widget-based homepage for internal staff with role-filtered widget picker, including a customizable Quick Notes widget.
- **Employee File Forms**: Integrated DB-backed forms for Time Off Requests, Resignation Letters, and Corrective Action Reports, featuring digital signatures and notification systems.
- **MORS Budget Module**: Core financial planning tool with 9 DB tables, full seed data (2026 budget with 20 field employees, 3 overhead staff, 18 owned + 5 leased equipment, 13 overhead categories, 35 overhead items, 3 divisions), server-side calculation engine (labor rate, breakeven rate, overhead markup, required revenue), and 8-tab UI: Overview (dashboard with rate cards + chart + step-by-step calc transparency), Labor (field/overhead sub-tabs with all calculated columns), Materials, Equipment (owned/leased), Subcontractors, Overhead (collapsible categories), Sales (targets vs required revenue gap analysis), and Mark Up (class pricing defaults for overhead % and profit margin %). The /budget-settings route now redirects to /mors-budget?tab=mark-up.
- **Reports Module**: Business analytics for Admin/Manager roles covering Revenue, Job Costing, Invoice Aging, and Crew Hours with various filters, visualizations, and detailed tables. Each report tab (Revenue, Invoice Aging, Crew Hours, Job Profitability, Time by Division, Materials Spend) has an "Export CSV" button next to its filters that downloads the currently displayed table data as CSV (client-side, respects active filters).
- **Settings Page**: Administrative hub for managing work areas, divisions, estimate templates, and company information with full CRUD capabilities.
- **Activity Log System**: Backend tracking of user activities with per-user seen tracking.
- **Bell Notification Panel**: Enhanced notification panel displaying activity logs and admin-posted updates.
- **User Tools**: Customizable User Profiles, Interactive Calendar, Document Sharing, Document Management, and Onboarding Forms System.
- **Customer Hub**: Customer-facing portal with dashboard, job details, document access, care library, and messaging.
- **Internationalization (i18n)**: Full English/Spanish language support with user preference stored in the database.
- **Daily Crew Worksheet**: Field reporting tool.
- **Time Tracking & GPS**: Comprehensive clock in/out system with various entry types, optional job linking, live elapsed timer, and GPS pinging.
- **My Hours Portal**: Employee self-service view of their own time entries by pay period or custom date range, with overtime summaries.
- **QuickBooks Time Export** (`/admin/qbo-export`): Admin tool to review completed time entries, map employees to QB Employee records, and bulk-export time activities to QuickBooks Online.
- **Time Entry Archive** (`/admin/archive`): Admin tool to safely archive old completed time entries into `time_entries_archive` table, keeping the active table fast. Includes preview, 409 guard for active clock-ins, archive history log, and filterable browse view.
- **Sales Pipeline (7-Part)**: Comprehensive CRM pipeline for Chapin Landscapes:
  - **Service Types Admin** (`/admin/service-types`): DB-backed service type management with 15 pre-seeded types (Patio, Walkway, Retaining Wall, Landscape, Irrigation, Spring/Summer/Fall Clean Up, Snow Removal, Salt Application, Full Install, Maintenance, Drainage, Lighting, Grading). Wired to Consultations, Estimates, and Jobs dropdowns.
  - **Pipeline Stages**: 19-stage color-coded Kanban pipeline (new_lead → closed) on Consultations page with List/Kanban toggle. Kanban columns color-coded by group: orange=new, blue=qualified, purple=estimate, green=sold/complete, red=lost.
  - **Lead Alerts**: In-app + email notifications to dan@chapinlandscapes.com on new leads; hourly cron checks for stale leads (4+ hours) with batch email digest.
  - **811 Auto-Task**: Auto-creates 811 utility task for Matt H (matt@chapinlandscapes.com) when consultation moves to `sold_approved` stage; skips Maintenance, Snow Removal, Salt Application, and Seasonal Clean Up types.
  - **Availability Settings**: `/settings` page with "Availability" tab — per-user weekly schedule (enable/disable days, start/end times), slot duration, buffer minutes. Booking URL generated per user.
  - **Public Inquiry Form** (`/inquiry`): No-auth public form with name, email, phone, property address, service type, project description, budget range, timeline, photo upload (up to 5), and agreement checkbox. Creates consultation as `new_lead` stage.
  - **Public Booking Page** (`/book/:username`): Calendar-based slot booking calculated from the salesperson's availability settings; sends confirmation email to customer and notification email + in-app alert to salesperson.
- **Gmail-style DM Messaging** (`/messages`): Full-featured direct messaging system with inbox/sent/starred/archive folders, conversation threads, message search (debounced, full-text), file attachments (via object storage), job/task linking, custom user-created folders, and print/export. Conversations can be linked to Jobs or Tasks using a "Linked to:" bar in the thread header. Job detail pages show a "Messages" tab listing linked conversations, and the Task edit modal shows a "Linked Messages" section. Custom folders (Gmail-style) allow users to create named, color-coded folder groups — each conversation can be added to a folder via a hover `...` menu on conversation rows or via the FolderPlus button in the thread header toolbar. Print & Export: thread header has a Printer button (opens formatted HTML print window with Chapin Landscapes branding) and a Download button (downloads `.txt` file). Conversation row `...` menu also includes an "Export (.txt)" option. Key tables: `direct_messages` (with `job_id`, `task_id` FK columns), `message_attachments`, `message_notifications`, `message_folders` (id, user_id, name, color), `message_folder_items` (folder_id, conversation_partner_id, user_id). Routes: GET/POST/DELETE/PATCH `/api/dm/folders`, POST/DELETE/GET `/api/dm/folders/:id/conversations`.

## External Dependencies

### Database
- PostgreSQL

### Frontend Libraries
- @tanstack/react-query
- shadcn/ui
- Radix UI
- Tailwind CSS
- Framer Motion
- Recharts
- @hello-pangea/dnd
- i18next / react-i18next

### Backend Libraries
- Express
- Passport (with passport-local)
- Drizzle ORM
- Zod
- pypdf (Python - for PDF field builder)

### Development Tools
- Vite
- esbuild
- Drizzle Kit
- TypeScript

### APIs / Services
- OpenAI
- Replit Object Storage
- Resend
- Google Maps API
- Google Calendar API
- NHTSA API