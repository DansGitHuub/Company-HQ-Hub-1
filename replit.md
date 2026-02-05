# Company HQ - Landscape Management Dashboard

## Overview
Company HQ is an all-in-one management dashboard designed for landscape installation and maintenance businesses. It centralizes tools for managing SOPs, inventory, hiring, marketing, job tracking, customer education, and employee management. The platform features role-based access control (Admin, Manager, Crew, Customer) and aims to streamline operations and enhance productivity for landscaping companies.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript
- **State Management**: React Query for server state, React Context for local state
- **UI**: shadcn/ui, Radix UI, Tailwind CSS v4 for styling
- **Features**: Framer Motion for animations, @hello-pangea/dnd for drag & drop, Recharts for data visualization, React Hook Form with Zod for form handling.
- **Theming**: 8 landscape-inspired themes with unique visual characteristics:
  - Each theme has distinct colors, border radius, shadows, and sidebar styles
  - Button styles: solid, outline, or soft depending on theme
  - Sidebar styles: solid, glass (blur), or gradient depending on theme
  - Input styles: minimal, bordered, or filled depending on theme
- **Navigation**: Traditional sidebar and "Tile View" with Grid, Radial, and Dock layouts.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API**: RESTful JSON API
- **Authentication**: Passport.js local strategy, Express-session with PostgreSQL store, scrypt for password hashing.
- **AI Assistant**: OpenAI integration for AI chat, streaming responses via SSE, conversation history stored per user.

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema**: Shared between frontend and backend (`shared/schema.ts`)
- **Key Models**: Users (role-based), SOPs, Materials, Material Categories, Category Fields, Hiring Candidates, Marketing Campaigns, Jobs, Customer Messages, Work Requests, Custom Forms, Equipment, Customer Resources.

### Core Features
- **Role-Based Access Control (RBAC)**: Differentiated access for Admin, Manager, Crew, and Customer roles, including a Master Admin for critical operations.
- **Access Request System**: Users can request role upgrades, managed by Admins.
- **Registration Security**: Public registrations default to Customer role.
- **Build System**: Vite for frontend, esbuild for backend production build.
- **Help System**: Interactive walkthroughs, role-specific FAQs, and an Admin "Test My Software" preview mode.
- **User Profiles**: Customizable profiles with picture uploads (Replit Object Storage).
- **Form Builder**: Admin-only dynamic form creation with various field types, draft/published workflow, and AI-powered form generation.
- **Employee Portal**: Dedicated section for employee-specific information like payroll, time off, and personal details.
- **Equipment Tracker**: Manage equipment, schedule recurring maintenance, log activities, and receive email reminders.
- **Customer Hub / Resource Library**: Centralized educational content (guides, instructions, documents) with categorisation, admin management, and user bookmarking.
- **Company Branding**: Admin configurable logo (Replit Object Storage) and company name with live preview.
- **Enhanced Hiring Pipeline**: Detailed candidate management, job type/work type filtering, 3-dot rating, document uploads, and acknowledgment tracking.
- **Enhanced Job Pipeline**: Tabbed interface for job types, detailed job cards with location, deadlines, estimated hours, and document uploads.
- **Global Search**: Role-based search functionality across key modules (SOPs, Materials, Jobs, Candidates, Users).
- **Communications Center**: Internal messaging system with threaded conversations (inspired by Zendesk/Salesforce), role-based access control, assignment system, status workflow (open, in_progress, resolved, closed), priority levels (low, normal, high, urgent), internal notes visible only to staff, admin supervision with employee/customer filters, and unread tracking per role. Customers see only their threads, employees see assigned conversations, admins can view/filter all.
- **Materials Catalog Manager**: Comprehensive materials management with 8 specialized categories (Aggregates & Gravel, Mulch & Soil, Trees & Shrubs, Perennials & Annuals, Hardscape & Pavers, Landscape, Chemicals & Fertilizer, Other), AI-powered 5-step material creation wizard (Name → Category → AI Auto-Fill → Review → Confirm), category-specific custom fields, bulk operations (select all, move to category), easy category management (add, rename, delete), search/filter/sort capabilities, and role-based access.
- **Interactive To-Do List**: Task management system with add/edit/delete functionality, priority levels (low, medium, high, urgent), status tracking (pending, in_progress, completed), due dates, user assignments, read/unread status, filtering by status and priority, notification badges in sidebar for unread tasks, and admin-controlled user activation.
- **Plow Site Mapper**: Snow removal route planning tool with Google Maps integration for accurate address lookup, interactive satellite imagery with zoom controls, AI-powered property analysis, site grouping with organizational categories, multi-step site creation workflow (Info → Image Selection → Confirmation), canvas-based markup tools for annotating property images, and instruction management for plow crews.
- **AI Agents System** (Master Admin only): Autonomous AI agents that analyze and improve various systems. Features include:
  - **Agent Management**: On/off toggles for each agent, manual run triggers, and scheduling options (manual, daily, weekly, monthly).
  - **Available Agents**: Forms Manager (form improvements), SOP Assistant (SOP enhancements), Communication Optimizer (messaging improvements), Hiring Helper (hiring pipeline optimization).
  - **Cost Tracking**: Real-time cost tracking per agent, monthly cost projection, next billing date display, and cost breakdown by agent.
  - **AI Suggestions**: Each agent generates detailed improvement suggestions with cost estimates and priority levels. Suggestions can be marked as implemented or dismissed.
  - **Security**: Master Admin access only - hidden from other users entirely.
- **Update Notification System**: Role-based app update announcements with bell icon button in header, popup showing new features/improvements/fixes, user acknowledgment tracking, and mark-all-read functionality. Admins can create/edit/delete updates with version numbers, categories (feature, improvement, fix, security), and role-based visibility.
- **Help Articles System**: Database-backed searchable help articles with role-based filtering (15 comprehensive articles covering all platform features). Categories organize articles, and users can search across titles, summaries, and content. Integrated into the Help page alongside existing walkthrough features. Includes article feedback/reporting system:
  - **Report Issues**: Users can report outdated, incorrect, unclear, or missing information in articles
  - **Admin Reports Center**: "Help Reports" tab in Admin Panel for reviewing and resolving article reports
  - **User Notifications**: When admins resolve reports and update articles, users with sufficient role level receive notifications
  - **Report Status Workflow**: pending → in_progress → resolved/dismissed
- **Floating Assistant Button**: Combined access point (sparkle icon) in bottom-right corner that opens a menu with AI Assistant chat and Help Center navigation options. Replaces standalone chat button for better discoverability.
- **Interactive Calendar**: Clickable calendar in the header that opens a mini calendar view with external calendar connection management:
  - **Mini Calendar**: Monthly view with day navigation
  - **Calendar Connections**: Connect to Google Calendar, Apple Calendar, Samsung Calendar, or Outlook
  - **Connection Wizard**: Step-by-step flow to connect external calendars (Select provider → Authorize → Complete)
  - **Connection Status**: Visual indicators showing connected, pending, or error states
  - **Fix Connection**: One-click repair button for broken connections
  - **Connection Management**: Add and remove calendar connections easily
- **Diagnostic Report System** (Master Admin only): Comprehensive error tracking and system monitoring tool with two viewing modes:
  - **Simple Mode**: Non-technical view showing system health status (Excellent/Good/Needs Attention), quick stats (users, SOPs, materials, jobs, todos), recent issues summary, and recent activity feed.
  - **Advanced Mode**: Full technical details including error counts by severity and feature, system usage breakdowns, error analysis by endpoint and time, detailed error logs with stack traces, activity logs with metadata, and most active users ranking.
  - **Error Tracking**: Automatic logging of API errors, frontend React errors (via ErrorBoundary), and user actions across all features.
  - **Activity Logging**: Tracks key user actions like create, update, delete operations with feature context and success status.
  - **Report Export**: Download diagnostic reports as JSON for sharing with technical support.
  - **Error Resolution**: Mark errors as resolved with timestamp and resolver tracking.
  - **Security**: Master Admin access only - hidden from other users entirely.

## External Dependencies

### Database
- PostgreSQL
- connect-pg-simple

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
- OpenAI (for AI Assistant)
- Replit Object Storage (for file uploads like profile pictures, company logos)
- Resend (for email reminders, e.g., maintenance)

### Environment Variables
- `DATABASE_URL`
- `SESSION_SECRET`
- `GOOGLE_MAPS_API_KEY` (for Plow Site Mapper address lookup and satellite imagery)