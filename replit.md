# Company HQ - Landscape Management Dashboard

## Overview
Company HQ is an all-in-one management dashboard designed for landscape installation and maintenance businesses. Its primary purpose is to centralize and streamline operations, covering areas such as standard operating procedures (SOPs), inventory, hiring, marketing, job tracking, customer education, and employee management. The platform features robust role-based access control (Admin, Manager, Crew, Customer) to enhance productivity and organization within landscaping companies.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features 8 landscape-inspired themes. Navigation uses a traditional sidebar with sections for My Workspace, Work, People, Company, Admin (role-specific), and Customer Hub/Resource Library. A calendar is accessible via a top bar icon. All navigation elements adhere to strict sizing and styling guidelines. Layout rules dictate consistent bottom padding, button placement, sidebar item length, and exclusion zones for floating elements. Consistent hover effects are implemented across all clickable elements. The Admin Panel navigation is organized into 4 categories (People, Content, AI & Tools, System) with sub-tabs. The Dashboard ("My Workspace") is a customizable widget-based homepage.

### Technical Implementation
The frontend is built with React and TypeScript, leveraging React Query for server state management and React Context for local state. UI components use shadcn/ui and Radix UI, styled with Tailwind CSS v4. Animations are handled by Framer Motion, drag-and-drop by @hello-pangea/dnd, and data visualization by Recharts. Form management uses React Hook Form and Zod. The backend uses Node.js with Express and TypeScript, providing a RESTful JSON API. Authentication relies on Passport.js local strategy with Express-session and scrypt. Data is stored in PostgreSQL, managed with Drizzle ORM and drizzle-zod, utilizing a shared schema. Vite manages frontend builds, and esbuild manages backend builds.

### Feature Specifications
- **Role-Based Access Control (RBAC)**: Supports Admin, Manager, Crew, Customer, and Master Admin roles with differentiated access.
- **AI Assistant**: Integrates OpenAI for AI chat with streaming responses, per-user conversation history, a tool library for system functionalities, and full voice capabilities (speech-to-text, text-to-speech with 6 voice options, per-user voice settings).
- **SOP Management**: Centralized SOPs with AI-powered quiz generation and an adaptive quiz system. Includes an AI-powered SOP Pipeline for topic suggestion and generation.
- **Inventory Management**: Comprehensive materials catalog with an AI-powered creation wizard.
- **Hiring & HR Module**: Full hiring pipeline with a 7-column Kanban board, applicant detail panels, employee records, and HR email templates.
- **Marketing Campaigns**: Database-backed campaign management with CRUD operations, a summary dashboard, and performance visualization.
- **Work Pipeline**: Features "Sold Jobs" (Kanban board) and "Estimates" (separate Kanban board with stages like New Lead, Site Visit, Won, Lost, and conversion to Sold Job).
- **Customer Hub / Resource Library**: Centralized educational content for customers with bookmarking.
- **Employee Management**: Employee Portal for payroll, time off, and personal details.
- **Equipment / Fleet Management**: Full fleet management system with a health dashboard, sortable asset table, detailed profiles, OEM maintenance library, priority engine, VIN decode, and document management.
- **Interactive Calendar**: Full calendar module with multiple views, event CRUD, expanded event types, Google Calendar OAuth sync, team member assignment, company-wide events, contact fields, and search/filtering.
- **Admin Tools**: Includes a dynamic Form Builder, Company Branding, interactive Help System, Global Search, Communications Center, Lead Qualifier, Plow Site Mapper, AI Agents System, Update Notification System, Help Articles, Diagnostic Report System, PDF Field Placer, and Property Report Card tool.
- **Task Management System**: Full task system with Kanban board (To Do, In Progress, Waiting, Complete, Cancelled), list view, open pool for unassigned tasks, quick add bar, and scheduling.
- **Todo System**: Renamed to "Tasks" in sidebar, features todo-to-calendar sync and reminder scheduling.
- **Document Sharing System**: Cross-module document sharing from a central Document Library, allowing sharing to modules and record-level attachments.
- **Customer Suggestions**: Customers can submit improvement suggestions via a dedicated interface, with admin review and status management.
- **Customizable Dashboard**: Widget-based homepage for internal staff, allowing users to add/remove/reorder/resize widgets from a role-filtered picker.
- **Settings Page**: Centralized settings for Profile & Account, Notifications, Language & Display, Appearance, and Admin Settings.
- **Activity Log System**: Backend activity tracking for various events with per-user seen tracking.
- **Bell Notification Panel**: Enhanced notification panel displaying activity logs with seen/unseen tracking and admin-posted updates.
- **User Tools**: Features customizable User Profiles, an Interactive Calendar, a Document Sharing system, a unified Document Management System, and an Onboarding Forms System.
- **Customer Hub**: A customer-facing portal providing a branded UI with a dashboard, job details, document access, a care library, and messaging functionality.
- **Internationalization (i18n)**: Full English/Spanish language support using `i18next` and `react-i18next`, with user language preference stored in the database.

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
- OpenAI (AI Assistant, quiz generation, property analysis)
- Replit Object Storage (profile pictures, company logos)
- Resend (email reminders)
- Google Maps API (Plow Site Mapper)
- Google Calendar API (Calendar sync via OAuth)
- NHTSA API (VIN decoding for fleet management)