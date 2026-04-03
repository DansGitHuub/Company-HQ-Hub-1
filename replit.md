# Company HQ - Landscape Management Dashboard

## Overview
Company HQ is an all-in-one management dashboard for landscape installation and maintenance businesses. It centralizes and streamlines operations including SOPs, inventory, hiring, marketing, job tracking, customer education, and employee management. The platform features robust role-based access control (Admin, Manager, Crew, Customer) to enhance productivity and organization.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform offers 8 landscape-inspired themes and uses a traditional sidebar navigation with sections like My Workspace, Work, People, Company, Admin (role-specific), and Customer Hub/Resource Library. A calendar icon is in the top bar. All navigation elements adhere to strict sizing and styling. Layouts maintain consistent padding, button placement, and exclusion zones. Consistent hover effects are present. The Admin Panel navigation is divided into People, Content, AI & Tools, and System. The Dashboard ("My Workspace") is a customizable widget-based homepage.

### Technical Implementation
The frontend is built with React and TypeScript, using React Query for server state and React Context for local state. UI components are from shadcn/ui and Radix UI, styled with Tailwind CSS v4. Framer Motion handles animations, @hello-pangea/dnd for drag-and-drop, and Recharts for data visualization. Form management uses React Hook Form and Zod. The backend is Node.js with Express and TypeScript, providing a RESTful JSON API. Authentication uses Passport.js local strategy with Express-session and scrypt. Data is stored in PostgreSQL, managed by Drizzle ORM and drizzle-zod, using a shared schema. Vite builds the frontend, and esbuild builds the backend.

### Feature Specifications
- **Role-Based Access Control (RBAC)**: Supports Admin, Manager, Crew, Customer, and Master Admin roles.
- **AI Assistant**: Integrates OpenAI for AI chat with streaming responses, per-user conversation history, a tool library, and full voice capabilities (speech-to-text, text-to-speech with 6 voice options).
- **SOP Management**: Centralized SOPs with AI-powered quiz generation and adaptive quizzes. Includes an AI-powered SOP Pipeline for topic suggestion, full content generation (with AI images), and auto-scheduling. Features an AI Editor for inline rewriting and image regeneration with version history.
- **Employee Quiz History Tracking**: Every quiz attempt is permanently recorded in `user_quiz_attempts` (score, pass/fail, date/time, highest level reached, final score label). Admin/Manager can view a dedicated **Quizzes** tab on any employee's file showing: total attempts, pass rate, unique quizzes taken, and a full chronological attempt log with SOP name, quiz title, safety-critical flag, score, percentage, pass/fail badge, level reached, and timestamp. Backend route: `GET /api/quiz-attempts/user/:userId` (Admin/Manager only). Used for HR decisions on raises, bonuses, and promotions.
- **Inventory Management**: Comprehensive materials catalog with an AI-powered creation wizard.
- **Hiring & HR Module**: Full hiring pipeline with a 7-column Kanban board, applicant detail panels, employee records, HR email templates, a public application form system, interview scheduling (including Zoom integration), offer letter management, and candidate offer acceptance flow with digital signature. It also includes applicant status portal and customizable email templates for various stages.
- **Marketing Campaigns**: Database-backed campaign management with CRUD, a dashboard, and performance visualization.
- **Work Pipeline**: Features "Sold Jobs" and "Estimates" Kanban boards with conversion capabilities (legacy, now at `/pipeline`). Legacy pipeline routes renamed to `/api/pipeline-estimates` to avoid conflict with new Estimates module.
- **Estimates Module**: Full sales estimate system at `/estimates` (WORK nav). Three DB tables: `sales_estimates`, `estimate_work_areas`, `estimate_line_items`. Three reusable template types seeded (Maintenance Contract, Landscape Project, Snow & Ice Contract). List page with status tabs (All/Draft/Sent/Viewed/Approved/Declined/Converted), search, and a clickable table. Detail page (`/estimates/:id`) with left column (title, customer message, scope of work with line items, pricing summary, terms) and right sidebar (customer info, dates, salesperson, customer response). `EstimateFormModal` supports: template selection, customer search, property filtering, work area management, line item management (service/material/labor), tax/discount/down-payment calculation, notes/terms/customer message. Status transitions: draft → sent → approved/declined → converted to job. Customer detail page has an Estimates tab. Backend routes: `server/estimateRoutes.ts`, migration: `server/migrations/newEstimates.ts`. Estimate numbers formatted as EST-0001 via PostgreSQL sequence.
- **Jobs Module**: Full Jobs management at `/jobs` (WORK nav). List page with status tabs (All/Lead/Scheduled/In Progress/Completed/Invoiced), search, date range filter, and a sortable table. Detail page (`/jobs/:id`) with two-column layout: left card shows status (large clickable dropdown), customer link, property, job type, scheduled date/time, price, crew notes; right tabbed area (Overview stats, Time Entries table, Notes editor, Activity timeline). Shared `JobFormModal` used by both pages with customer search, property auto-filter, and all job fields. DB migration: `server/jobsMigration.ts` adds title, description, status, job_type, scheduled_start_time, scheduled_end_time, price, crew_notes, customer_id, property_id columns to existing jobs table using ADD COLUMN IF NOT EXISTS. Backend routes: `server/jobRoutes.ts`.
- **Customer Hub / Resource Library**: Centralized educational content for customers with bookmarking.
- **Employee Management**: Employee Portal for payroll, time off, and personal details, including a system for Time Off Requests, Resignation Letters, and Corrective Action Reports. Corrective actions have a two-way signing workflow: Admin/HR issues a report → employee receives an in-app notification and a forced (non-dismissible) modal on their portal that requires their digital signature → after signing, Admin/HR is notified → both sides see the signed record. Status tracks "Pending Signature" / "Signed".
- **Equipment / Fleet Management**: Full fleet management with health dashboard, asset table, OEM maintenance library, VIN decode, and document management.
- **Interactive Calendar**: Full calendar module with multiple views, event CRUD, Google Calendar OAuth sync, team assignment, and search/filtering.
- **Scheduling / Dispatch Calendar**: Full-screen weekly dispatch board at `/scheduling` (WORK nav). Left panel shows draggable unscheduled job cards; right shows a Mon–Sun time grid (6am–7pm, 64px/hr). Drop a job onto any time cell → modal to confirm date/time, division (Maintenance/Install/Snow/General with color coding), and crew selection. Scheduled job cards appear in the correct hour slot; hover X removes them. Backend tables: `job_assignments` (VARCHAR(36) FKs to jobs + employees), new `division` + `color` columns on jobs. Backend routes: `server/schedulingRoutes.ts`. Migration: `server/migrations/scheduling.ts`.
- **Admin Tools**: Includes a dynamic Form Builder with visual templates, Company Branding, Help System, Global Search, Communications Center, Lead Qualifier, Plow Site Mapper, AI Agents System, Update Notification System, Help Articles, Diagnostic Report System, PDF Field Placer, and Property Report Card tool. All tools on the Tools page open in full-screen overlay modals (not new pages), with a prominent modal header, Close button, and Done/Cancel buttons where applicable. Tool components (Calculator, LeadQualifier, PlowSiteMapper) accept optional `onClose` prop.
- **Task Management System**: Full task system with Kanban board (To Do, In Progress, Waiting, Complete, Cancelled), list view, open pool, quick add, and scheduling.
- **Document Sharing System**: Cross-module document sharing from a central Document Library.
- **Customer Suggestions**: Customers can submit improvement suggestions for admin review.
- **Employee Agreement System**: Admin manages position-based agreement templates with HTML body + variable placeholders ({{employee_name}}, {{pay_rate}}, {{start_date}}, {{year}}, {{position}}). Send to any employee with pay rate and start date; employee receives a signing link at /agreement/:token, reviews the rendered agreement, signs digitally, and the signed copy is archived. Admin sees all sent agreements (Pending/Signed) in the employee's Documents tab. Templates managed from Admin Panel → Agreement Templates.
- **Customizable Dashboard**: Widget-based homepage for internal staff with role-filtered widget picker. Includes a **Quick Notes widget** — a personal notepad with color-coded cards (8 colors), pin, archive, tag, and reminder support. Full notepad opens in a 97vw × 93vh dialog with masonry grid, search, filter tabs (All/Pinned/Reminders/Archived), and a rich in-place editor. AI assistant can create and retrieve notes via `createNote` / `getNotes` tools.
- **Employee File Forms**: Three DB-backed employee forms fully integrated — (1) **Time Off Requests** (Vacation/Sick/Personal/Unpaid) with status tracking and Admin/Manager approval/denial from employee file; (2) **Resignation Letters** with digital signature pad, instant in-app + email notifications to all Admins/Managers; (3) **Corrective Action Reports** with role-based issuance permissions (Manager → Crew only, Admin → anyone), forced employee acknowledgment modal with digital signature, and two-way signing workflow. Employee file Documents tab is organized into 4 sections: Personal Info, Onboarding Forms, Employment Documents, and Employee-Initiated Forms.
- **Settings Page**: Centralized settings for Profile & Account, Notifications, Language & Display, Appearance, and Admin Settings.
- **Activity Log System**: Backend activity tracking with per-user seen tracking.
- **Bell Notification Panel**: Enhanced notification panel displaying activity logs and admin-posted updates.
- **User Tools**: Customizable User Profiles, Interactive Calendar, Document Sharing, Document Management, and Onboarding Forms System.
- **Customer Hub**: Customer-facing portal with dashboard, job details, document access, care library, and messaging.
- **Internationalization (i18n)**: Full English/Spanish language support with user preference stored in the database.
- **Daily Crew Worksheet**: Full field reporting tool in the WORK nav section (`/daily-worksheet`).
- **Time Tracking & GPS**: Clock in/out system at `/time` (WORK nav). DB tables: `time_entries` (id, user_id, job_id, clock_in, clock_out, duration_minutes, entry_type, notes), `gps_pings` (id, user_id, time_entry_id, lat, lng, accuracy, recorded_at). Floating `TimeClock` widget in the app header. Supports 6 entry types (Billable, Non-Billable, Drive Time, Break, Shop Time, Meeting), optional job linking, live elapsed timer, GPS pinging every 60 s while clocked in. Backend routes: `server/timeRoutes.ts`.

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