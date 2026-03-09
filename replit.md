# Company HQ - Landscape Management Dashboard

## Overview
Company HQ is an all-in-one management dashboard for landscape installation and maintenance businesses. It centralizes SOPs, inventory, hiring, marketing, job tracking, customer education, and employee management. The platform features role-based access control (Admin, Manager, Crew, Customer) and aims to streamline operations and enhance productivity for landscaping companies.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Theming**: 8 landscape-inspired themes with distinct colors, border radius, shadows, and sidebar/button/input styles.
- **Navigation**: Traditional sidebar and "Tile View" with Grid, Radial, and Dock layouts.
- **Hover Effects**: Consistent hover effects across all clickable elements, categorized by type.
- **Layout Rules**: Strict guidelines for bottom padding, button placement, sidebar item length, and exclusion zones for floating elements.

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
    - **SOP Management**: Centralized management of SOPs with AI-powered quiz generation for training. Maintenance SOPs have two focus modes: "Specific Task Procedure" (generates procedure for the exact task in the SOP title) and "Full Equipment Schedule" (comprehensive OEM maintenance schedule). Equipment info includes Year, Engine/Power Type, and Fuel Type for accurate AI specs. Intervals support both preset options and custom freeform text (e.g., "Every 7,500 miles").
    - **Inventory Management**: Comprehensive materials catalog manager with AI-powered creation wizard and category-specific fields.
    - **Hiring Pipeline**: Detailed candidate management with filtering, rating, and document uploads.
    - **Marketing Campaigns**: Tools for managing marketing efforts.
    - **Job Tracking**: Tabbed interface for job types, detailed job cards with location, deadlines, and document uploads.
    - **Customer Hub / Resource Library**: Centralized educational content with categorization and user bookmarking.
    - **Employee Management**: Employee Portal for payroll, time off, and personal details.
    - **Equipment Tracker**: Management, maintenance scheduling, activity logging, and automated email reminders with recurring notifications via Resend.
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
    - **Interactive To-Do List**: Task management with priorities, statuses, due dates, assignments, and notifications.
    - **Interactive Calendar**: Mini calendar view with external calendar connection management (Google, Apple, Samsung, Outlook).
    - **Floating Assistant Button**: Combined access point for AI Assistant and Help Center.

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