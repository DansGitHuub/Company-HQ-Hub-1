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
- **Theming**: 8 landscape-inspired color themes, user-selectable and persistent.
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
- **Key Models**: Users (role-based), SOPs, Materials, Hiring Candidates, Marketing Campaigns, Jobs, Customer Messages, Work Requests, Custom Forms, Equipment, Customer Resources.

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
- **Direct Employee Messaging**: Customers can send messages to specific employees or the general inbox.

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