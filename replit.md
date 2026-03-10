# Company HQ - Landscape Management Dashboard

## Overview
Company HQ is an all-in-one management dashboard for landscape installation and maintenance businesses. It centralizes SOPs, inventory, hiring, marketing, job tracking, customer education, and employee management. The platform features role-based access control (Admin, Manager, Crew, Customer) and aims to streamline operations and enhance productivity for landscaping companies.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Theming**: 8 landscape-inspired themes with distinct colors, border radius, shadows, and sidebar/button/input styles.
- **Navigation**: Traditional sidebar with labeled sections and "Tile View" with Grid, Radial, and Dock layouts. Sidebar sections: FIELD OPS (Dashboard, Jobs, Equipment, Materials, Tools, To-Do List), PEOPLE (Hiring, Employees), KNOWLEDGE (SOP Library, Quizzes, Forms, Help), CUSTOMERS (Customer Hub), COMPANY (CompanyHQ, Marketing, Plow Mapper, Integrations), ADMIN (Admin Panel). Role-based section visibility: Crew/New Hire see FIELD OPS + KNOWLEDGE; Crew Lead adds PEOPLE; Manager/HR/Sales see all except ADMIN; Admin sees all. Care Guides removed from main sidebar (accessible inside Customer Hub only). Active module highlighted in sidebar.
- **Hover Effects**: Consistent hover effects across all clickable elements, categorized by type.
- **Layout Rules**: Strict guidelines for bottom padding, button placement, sidebar item length, and exclusion zones for floating elements. Quick Add task button positioned to avoid overlap with sidebar user profile area.

### Technical Implementation
- **Frontend**: React with TypeScript, React Query for server state, React Context for local state, shadcn/ui, Radix UI, Tailwind CSS v4, Framer Motion for animations, @hello-pangea/dnd for drag & drop, Recharts for data visualization, React Hook Form with Zod.
- **Backend**: Node.js with Express, TypeScript, RESTful JSON API.
- **Authentication**: Passport.js local strategy, Express-session with PostgreSQL store, scrypt for password hashing.
- **Data Storage**: PostgreSQL, Drizzle ORM with drizzle-zod, shared schema (`shared/schema.ts`).
- **Build System**: Vite for frontend, esbuild for backend.

### Feature Specifications
- **Role-Based Access Control (RBAC)**: Admin, Manager, Crew, Customer, and Master Admin roles with differentiated access and an access request system. Public registrations default to Customer.
- **AI Assistant**: OpenAI integration for AI chat with streaming responses and per-user conversation history.
- **Core Modules**:
    - **SOP Management**: Centralized management of SOPs with AI-powered quiz generation for training. Maintenance SOPs have two focus modes: "Specific Task Procedure" (generates procedure for the exact task in the SOP title) and "Full Equipment Schedule" (comprehensive OEM maintenance schedule). Equipment info includes Year, Engine/Power Type, and Fuel Type for accurate AI specs. Intervals support both preset options and custom freeform text (e.g., "Every 7,500 miles"). **Adaptive Quiz System**: Single adaptive quiz per SOP with 12-15 questions across 5 difficulty levels (Foundational→Competent→Proficient→Advanced→Expert). Questions tagged with audience roles. Adaptive engine (`server/adaptiveEngine.ts`) adjusts difficulty in real-time: correct→level up, wrong→stay. Quiz-taking UI shows level badges, real-time progression, feedback per question, and end screen with mastery label and review areas. Manager view shows employee mastery levels, safety-critical alerts (employees below Level 2 on critical SOPs), and quiz settings (min pass level, safety flag). Migration in `server/quizMigration.ts`. Routes: `POST /api/quizzes/:id/start`, `/answer`, `/complete`, `GET /api/quiz-stats/employees`, `/safety-flags`, `PATCH /api/quizzes/:id/settings`.
    - **Inventory Management**: Comprehensive materials catalog manager with AI-powered creation wizard and category-specific fields.
    - **Hiring & HR Module**: Full hiring pipeline with 7-column Kanban board (New Application → Review → Phone Screen → Interview → Offer Extended → Hired → Not a Fit), drag-and-drop stage changes with automated email notifications, applicant detail panel (5 tabs: Profile, Documents, Communication, Interview, Onboarding), Employee Records section with table view and 7-tab employee profile (Personal, Employment, Pay, Documents, History, Notes, Onboarding), onboarding checklists auto-generated on hire, document upload/management, and HR email templates. Routes in `server/hiringRoutes.ts`.
    - **Marketing Campaigns**: Tools for managing marketing efforts.
    - **Job Tracking**: Tabbed interface for job types, detailed job cards with location, deadlines, and document uploads.
    - **Customer Hub / Resource Library**: Centralized educational content with categorization and user bookmarking.
    - **Employee Management**: Employee Portal for payroll, time off, and personal details.
    - **Equipment / Fleet Management**: Full fleet management system rebuilt from Equipment Tracker. Features: Fleet health dashboard with 6 summary tiles (Total, P1 Critical, P2 Due Soon, P3 Approaching, In Repair, Compliance), sortable/filterable asset table, asset detail profiles with 5 tabs (Overview, Maintenance Schedule, Service History, Repairs, Documents). OEM maintenance library with 53 pre-seeded templates (Exmark, Kubota, Stihl, Ford, GM, Ram, Generic Trailer). Priority engine (P1-P4) auto-calculates from hours/date thresholds. 4-step Add Equipment Wizard with VIN decode via NHTSA API and OEM template auto-assign. Quick actions: Update Hours, Log Service, Report Issue. Document management with folder organization. Calendar integration shows maintenance events with priority-colored dots. Auto-generated asset IDs (EQ-XXXX). Role-based access: Admin/Manager full, Crew view+log. Routes in `server/equipmentRoutes.ts` under `/api/fleet/*` prefix. Tables: equipment (extended), maintenance_schedules (extended), maintenance_logs (extended), equipment_uploads (extended), oem_maintenance_templates, repair_requests. Priority engine in `server/priorityEngine.ts`, OEM seed in `server/equipmentSeed.ts`, migration in `server/equipmentMigration.ts`.
- **Admin Tools**:
    - **Form Builder**: Dynamic form creation with AI-powered generation.
    - **Company Branding**: Configurable logo and name with live preview.
    - **Help System**: Interactive walkthroughs, role-specific FAQs, and Admin "Test My Software" preview mode.
    - **Global Search**: Role-based search across key modules.
    - **Communications Center**: Internal messaging system with threaded conversations, role-based access, assignment workflow, and unread tracking.
    - **Lead Qualifier**: Prospect scoring tool with 3-step wizard (contact info, weighted qualification questions, review/save). Persists results to `qualified_leads` table with hot/warm/cold/unqualified ratings. Staff-only access.
    - **Plow Site Mapper**: Snow removal route planning with Google Maps integration, AI-powered property analysis, and canvas-based markup tools.
    - **AI Agents System (Master Admin)**: Autonomous AI agents for system analysis and improvement with cost tracking and suggestion management.
    - **Update Notification System**: Role-based app updates with acknowledgment tracking.
    - **Help Articles System**: Searchable, categorized help articles with user feedback/reporting system.
    - **Diagnostic Report System (Master Admin)**: Comprehensive error tracking, system monitoring, activity logging, and development progress tracker.
- **User Tools**:
    - **User Profiles**: Customizable with picture uploads.
    - **Task Management System**: Full internal task management rebuilt from To-Do List. Features: Quick Add floating button (bottom-left, 3 fields, <10sec creation), full task creation form, 4 views (My Tasks, Assigned By Me, Team View, Reports). Status lifecycle: assigned→acknowledged→in_progress→on_hold/reassigned→completed→confirmed (or cancelled/overdue). Role-based assignment (Admin→anyone, Manager→Crew/New Hire, Crew Lead→Crew, Crew/New Hire→self). Dashboard with 6 summary tiles. Task detail with 4 tabs (Details, Checklist, History, Delegation). Reassignment with delegation chain tracking. Confirmation/send-back workflow. Recurring tasks engine (daily/weekly/biweekly/monthly/custom). Priority colors: P1=#C0392B red, P2=#E67E22 orange, P3=#F1C40F yellow, P4=#27AE60 green. Auto-generated task IDs (TK-0001+). Scheduler: escalation checks every 15min, overdue detection hourly, recurring generation hourly. Calendar integration with priority-colored dots. Reports tab with team overview and individual metrics. Routes in `server/taskRoutes.ts`. Validation in `server/taskValidation.ts`. Scheduler in `server/taskScheduler.ts`. Migration in `server/taskMigration.ts`. Tables: tasks, task_checklist_items, task_history, task_attachments, task_delegation_chain.
    - **Interactive Calendar**: Mini calendar view with external calendar connection management (Google, Apple, Samsung, Outlook).
    - **AI Assistant (Phase 1 + Phase 2)**: Floating AI assistant panel powered by OpenAI GPT-4o with function calling. Features: circular sparkle button (bottom-right), 380px side panel on desktop / full-width on mobile, conversation history per session, context-aware suggestion chips on open (overdue tasks, P1 alerts, unacknowledged tasks), 3-layer system prompt (user identity, behavioral rules, app context), conversation logging to assistant_conversations table. **Phase 2**: Full 15-tool library (navigateTo, openRecord, searchGlobal, searchEquipment, searchTasks, searchEmployees, searchSOPs, getDailyBriefing, createTask, updateTaskStatus, createEquipment, logEquipmentService, updateEquipmentHours, lookupVIN, submitRepairRequest). Confirmation flow for destructive actions (amber ActionPreviewCard with confirm/cancel). Tool executor with role-based permission enforcement. Agent Manager admin panel for CRUD on assistant_agents (custom prompts, tool filtering, role restrictions). Conversation Log Viewer admin panel with session browsing, user/date/tool filters, and usage stats (messages, tokens, estimated cost). Tool definitions in `server/assistantTools.ts`. Routes in `server/assistantRoutes.ts`. Migration in `server/assistantMigration.ts`. Frontend in `client/src/components/AIAssistantPanel.tsx`, `client/src/components/AssistantMessageCards.tsx`, `client/src/components/AssistantAgentManager.tsx`, `client/src/components/ConversationLogViewer.tsx`. Tables: assistant_conversations, assistant_agents.
    - **Customer Hub**: Customer-facing portal at /customer-hub with branded UI (dark green #1E3A2F, gold #C9A84C, cream #F7F3EC). Features: Dashboard with active job card and quick stats, My Jobs with detail views (scope, materials, crew notes), Documents with folder organization and request workflow, Care Library with 8 categories and bookmarking, Messages with threaded conversations. Admin-side: Care Guide Manager at /care-guides for CRUD/publish, Customer Accounts tab with invite workflow, customer welcome emails via Resend. Routes in `server/customerHubRoutes.ts`. Tables: customer_jobs, customer_documents, care_guides, customer_saved_guides, customer_notifications, customer_messages, customer_message_threads.

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
- NHTSA API (VIN decoding for fleet management)