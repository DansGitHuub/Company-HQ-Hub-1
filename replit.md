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
- **Hiring & HR Module**: Full hiring pipeline with a Kanban board, applicant tracking, employee records, HR email templates, public application forms, interview scheduling (Zoom integration), offer letter management, and digital signature for acceptance. Includes an applicant status portal.
- **Marketing Campaigns**: Database-backed campaign management with CRUD operations, dashboard, and performance visualization.
- **Work Pipeline**: Manages "Sold Jobs" and "Estimates" via Kanban boards.
- **Estimates Module**: A complete sales estimate system with template types, status tracking, detailed list and detail pages, customer interaction, and conversion to jobs.
- **Jobs Module**: Full job lifecycle management including list view with status tabs, search, detail pages with job specifics, time entries, notes, and activity timeline.
- **Customer Hub / Resource Library**: Centralized educational content for customers with bookmarking capabilities.
- **Employee Management**: Employee Portal for payroll, time off, and personal details, including time off requests, resignation letters, and corrective action reports with two-way digital signing workflows.
- **Equipment / Fleet Management**: Comprehensive fleet management with health dashboards, asset tracking, OEM maintenance library, VIN decoding, and document management.
- **Interactive Calendar**: Full calendar module with multiple views, CRUD operations for events, Google Calendar OAuth sync, team assignment, and search/filtering.
- **My Day (Crew Mobile View)**: Mobile-first page for daily job assignments, clock-in/out functionality, drive time, shop time, and break tracking with live timers and GPS integration.
- **Scheduling / Dispatch Calendar**: Full-screen weekly dispatch board for assigning unscheduled jobs to crews, with division color-coding and time-slot management.
- **Admin Tools**: A suite of tools including a dynamic Form Builder, Company Branding, Help System, Global Search, Communications Center, Lead Qualifier, Plow Site Mapper, AI Agents System, Update Notification System, Help Articles, Diagnostic Report System, PDF Field Placer, and Property Report Card tool, all accessible via full-screen overlay modals.
- **Task Management System**: Full task system with Kanban board, list view, open pool, quick add, and scheduling.
- **Document Sharing System**: Cross-module document sharing from a central Document Library.
- **Customer Suggestions**: Allows customers to submit improvement suggestions for admin review.
- **Employee Agreement System**: Manages position-based agreement templates with variable placeholders, digital signing workflows, and archived records.
- **Customizable Dashboard**: Widget-based homepage for internal staff with role-filtered widget picker, including a customizable Quick Notes widget.
- **Employee File Forms**: Integrated DB-backed forms for Time Off Requests, Resignation Letters, and Corrective Action Reports, featuring digital signatures and notification systems.
- **MORS Budget Module**: Core financial planning tool with 9 DB tables, full seed data (2026 budget with 20 field employees, 3 overhead staff, 18 owned + 5 leased equipment, 13 overhead categories, 35 overhead items, 3 divisions), server-side calculation engine (labor rate, breakeven rate, overhead markup, required revenue), and 7-tab UI: Overview (dashboard with rate cards + chart + step-by-step calc transparency), Labor (field/overhead sub-tabs with all calculated columns), Materials, Equipment (owned/leased), Subcontractors, Overhead (collapsible categories), Sales (targets vs required revenue gap analysis).
- **Reports Module**: Business analytics for Admin/Manager roles covering Revenue, Job Costing, Invoice Aging, and Crew Hours with various filters, visualizations, and detailed tables.
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
- **Gmail-style DM Messaging** (`/messages`): Full-featured direct messaging system with inbox/sent/starred/archive folders, conversation threads, message search (debounced, full-text), file attachments (via object storage), and job/task linking. Conversations can be linked to Jobs or Tasks using a "Linked to:" bar in the thread header — the link propagates to all messages in the conversation. Job detail pages show a "Messages" tab listing linked conversations, and the Task edit modal shows a "Linked Messages" section. Key tables: `direct_messages` (with `job_id`, `task_id` FK columns), `message_attachments`, `message_notifications`.

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