# Company HQ - Landscape Management Dashboard

## Overview
Company HQ is an all-in-one management dashboard designed for landscape installation and maintenance businesses. Its primary purpose is to centralize and streamline operations, covering areas such as standard operating procedures (SOPs), inventory, hiring, marketing, job tracking, customer education, and employee management. The platform features robust role-based access control (Admin, Manager, Crew, Customer) to enhance productivity and organization within landscaping companies.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features 8 landscape-inspired themes (theme switcher UI hidden for now). Navigation uses a traditional sidebar organized into sections: (top) My Workspace, WORK (Jobs, Tasks, Equipment), PEOPLE (Employees, Customer Hub, Hiring), COMPANY (Messages, Forms, SOP Library, Quizzes), ADMIN (Admin Panel, Tools, CompanyHQ). Admin section is only visible to Admin role. Calendar is accessed via the top bar icon (opens as full-screen overlay). All navigation elements adhere to strict sizing and styling guidelines. Layout rules dictate consistent bottom padding, button placement, sidebar item length, and exclusion zones for floating elements. Consistent hover effects are implemented across all clickable elements.

### Technical Implementation
The frontend is built with React and TypeScript, leveraging React Query for server state management and React Context for local state. UI components are developed using shadcn/ui and Radix UI, styled with Tailwind CSS v4. Animations are handled by Framer Motion, drag-and-drop functionality by @hello-pangea/dnd, and data visualization by Recharts. Form management is implemented with React Hook Form and Zod for validation. The backend uses Node.js with Express and TypeScript, exposing a RESTful JSON API. Authentication relies on Passport.js local strategy with Express-session and scrypt for password hashing. Data is stored in PostgreSQL, managed with Drizzle ORM and drizzle-zod, utilizing a shared schema. Frontend builds are managed by Vite, and backend builds by esbuild.

### Feature Specifications
- **Role-Based Access Control (RBAC)**: Supports Admin, Manager, Crew, Customer, and Master Admin roles with differentiated access and an access request system.
- **AI Assistant**: Integrates OpenAI for AI chat with streaming responses, per-user conversation history, and a tool library for interacting with various system functionalities, including a confirmation flow for destructive actions. Features full voice capabilities: speech-to-text (Web Speech API), text-to-speech (OpenAI TTS with 6 voice options), per-user voice settings (enable/disable, auto-speak, voice selection), global floating mic button, session-level mic/speaker toggles in the assistant header, and animated waveform visualizations. Voice settings configurable in Profile page. Routes: `/api/ai/speak`, `/api/users/voice-settings`.
- **SOP Management**: Centralized SOPs with AI-powered quiz generation. Includes adaptive quiz system with 5 difficulty levels, real-time progression, and manager oversight for employee mastery and safety-critical alerts.
- **Inventory Management**: Comprehensive materials catalog with an AI-powered creation wizard.
- **Hiring & HR Module**: Full hiring pipeline with a 7-column Kanban board, drag-and-drop functionality, applicant detail panels, employee records, onboarding checklists, document management, and HR email templates.
- **Marketing Campaigns**: Tools for managing marketing efforts.
- **Work Pipeline** (formerly "Jobs"): Renamed to "Work" in sidebar. Features two top-level views: **Sold Jobs** (kanban board with Lead→Completed stages, custom category tabs, drag-and-drop, job documents) and **Estimates** (separate kanban with stages: New Lead, Contact Made, Site Visit, Proposal Sent, Follow Up, Won, Lost). Estimates support role-based drag (Admin only), "Convert to Sold Job" on Won estimates, email-customer-on-stage-change checkbox, and auto-creation from customer work requests. Routes: `/jobs`, API: `/api/estimates/*`, `/api/estimates/:id/convert-to-job`. Table: `estimates`.
- **Customer Hub / Resource Library**: Centralized educational content for customers with bookmarking.
- **Employee Management**: Employee Portal for payroll, time off, and personal details.
- **Equipment / Fleet Management**: Full fleet management system with a health dashboard, sortable asset table, detailed profiles, OEM maintenance library, priority engine, VIN decode via NHTSA API, and document management.
- **Interactive Calendar**: Full calendar module with month/week/day/list views, event CRUD with role-based permissions, expanded event types (personal, job, shift, equipment, task, meeting, deadline, maintenance, company, customer_appointment + user-defined custom categories), Google Calendar OAuth sync (connect/disconnect per user, auto-push events, pull/sync Google Calendar events into CompanyHQ display with "Sync Now" button), team member assignment, company-wide events, contact fields (name, email, phone) on events, search and filtering with Google Calendar filter option. Google events shown in amber color, read-only in detail view. Calendar Settings panel (gear icon) allows per-user category customization: rename/recolor default categories + create custom categories. Month view day popup shows all events when clicking day number or "+X more" link. Routes: `/calendar`, API: `/api/calendar/*`, `/api/calendar/google/sync`, `/api/calendar/google/events`, `/api/calendar/settings`. Tables: `calendar_events` (with `contact_name`, `contact_email`, `contact_phone` columns), `google_calendar_events`, `user_calendar_settings`.
- **Admin Tools**: Includes a dynamic Form Builder, Company Branding options, an interactive Help System, Global Search, an internal Communications Center, a Lead Qualifier, a Plow Site Mapper (with Google Maps and AI), an AI Agents System for system analysis (Master Admin), an Update Notification System, Help Articles, a Diagnostic Report System (Master Admin), a PDF Field Placer tool (with backend PDF builder using Python/pypdf), and a Property Report Card tool (multi-screen assessment tool for property health across 6 categories with scoring, PDF generation via jsPDF/html2canvas, localStorage persistence, rendered in a full-screen modal via MemoryRouter at `client/src/tools/property-report-card/`).
- **Task Management System**: Full task system at `/tasks` with kanban board (drag-and-drop status columns: To Do, In Progress, Waiting, Complete, Cancelled), list view, "My Tasks" filter view. Features open pool for unassigned tasks, quick add bar, create/edit modal with comments, custom fields, attachments, linked records (jobs/customers), scheduling (start/due dates, time estimates, reminders). Role-based permissions (Admin/Manager see all, Crew sees own + open pool). Overdue badge on sidebar. Routes: `/api/tasks/*`. Tables: `tasks`, `task_comments`, `task_custom_fields`, `task_attachments`, `task_checklist_items`, `task_history`, `task_delegation_chain`. Note: Kanban task route (`/tasks`) is removed from nav; DB tables retained for API use.
- **Todo System**: Renamed to "Tasks" in sidebar (route `/todos`). Features todo-to-calendar sync (creates calendar events when due dates are set), reminder scheduling with `reminderDate`/`reminderSent` columns, and linked record support (`linkedRecordType`/`linkedRecordId`). Scheduler checks todo reminders hourly. Routes: `/api/todos/*`.
- **Document Sharing System**: Cross-module document sharing from the Document Library. Admins/Managers share documents to modules (Employee, Hiring, Job, Equipment, Customer) via "Share to Modules" dialog with optional record targeting. Each module's Documents tab has "Attach from Library" button to browse and attach shared documents. Uses `document_shares` table for module-level sharing and `document_links` for record-level attachments. Routes: `/api/document-shares`, `/api/document-shares/documents`, `/api/users`. Components: `ShareToModulesDialog.tsx`, `AttachFromLibraryDialog.tsx`.
- **Customer Suggestions**: Customers can submit improvement suggestions via a lightbulb button in the Customer Hub header. Submissions include title (max 200 chars) and optional description (max 1000 chars). Customers see their own suggestions with status badges in a "My Suggestions" dashboard section. Admins review all suggestions in Admin Panel "Suggestions" tab with status management (Received/Reviewing/Planned/Completed/Not Planned) and optional notes. Email notifications sent on submission (confirmation to customer) and status changes (update to customer). Routes: `/api/suggestions` (POST create, GET admin list), `/api/suggestions/mine` (GET customer's own), `/api/suggestions/:id` (PATCH admin update). Table: `customer_suggestions`.
- **User Tools**: Features customizable User Profiles, an Interactive Calendar with external integrations, a Document Sharing system with token-based access and configurable security, a unified Document Management System with cross-linking, and an Onboarding Forms System with 11 fillable digital forms, signature pads, and PDF generation.
- **Customer Hub**: A customer-facing portal providing a branded UI with a dashboard, job details, document access, a care library, and messaging functionality.

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
- OpenAI (AI Assistant, quiz generation, property analysis)
- Replit Object Storage (profile pictures, company logos)
- Resend (email reminders)
- Google Maps API (Plow Site Mapper)
- Google Calendar API (Calendar sync via OAuth)
- NHTSA API (VIN decoding for fleet management)