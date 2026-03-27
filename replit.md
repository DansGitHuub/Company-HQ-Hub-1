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
- **Work Pipeline**: Features "Sold Jobs" and "Estimates" Kanban boards with conversion capabilities.
- **Customer Hub / Resource Library**: Centralized educational content for customers with bookmarking.
- **Employee Management**: Employee Portal for payroll, time off, and personal details, including a system for Time Off Requests, Resignation Letters, and Corrective Action Reports. Corrective actions have a two-way signing workflow: Admin/HR issues a report → employee receives an in-app notification and a forced (non-dismissible) modal on their portal that requires their digital signature → after signing, Admin/HR is notified → both sides see the signed record. Status tracks "Pending Signature" / "Signed".
- **Equipment / Fleet Management**: Full fleet management with health dashboard, asset table, OEM maintenance library, VIN decode, and document management.
- **Interactive Calendar**: Full calendar module with multiple views, event CRUD, Google Calendar OAuth sync, team assignment, and search/filtering.
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
- **Daily Crew Worksheet**: Full field reporting tool in the WORK nav section (`/daily-worksheet`). Supports draft saving and submit-with-email workflow. 7 sections: Job Information (weather conditions, customer, date, address, estimate#), Team Members & Time Log (foreman + 5 crew, auto-computed hours from arrival/departure times), Work Description (6 items: description, man hours, material, quantity), Punch List (5 items), Chemical Application Log (5 fixed chemicals with qty/location/vendor/cost), Equipment Log (4 fixed units), and Notes & Signature. On submission, emails a formatted HTML report to all Admin/Manager users. DB table: `daily_worksheets`. Backend routes: `server/dailyWorksheetRoutes.ts`.

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