# Company HQ - Landscape Management Dashboard

## Overview

Company HQ is an all-in-one management dashboard for landscape installation and maintenance businesses. It provides tools for managing SOPs (Standard Operating Procedures), materials inventory, hiring pipelines, marketing campaigns, job tracking, customer education, and employee management. The application supports role-based access control with Admin, Manager, Crew, and Customer roles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: 
  - React Query (@tanstack/react-query) for server state and API caching
  - React Context for local app state (see `client/src/lib/store.tsx`)
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **Animations**: Framer Motion for UI transitions
- **Drag & Drop**: @hello-pangea/dnd for Kanban-style boards (hiring pipeline)
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API with `/api` prefix
- **Authentication**: Passport.js with local strategy (username/password)
- **Sessions**: Express-session with PostgreSQL session store (connect-pg-simple)
- **Password Security**: scrypt hashing with timing-safe comparison

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Drizzle Kit (`db:push` command for schema sync)

### Key Data Models
- **Users**: Role-based (Admin, Manager, Crew, Customer) with password recovery tokens
- **SOPs**: Standard operating procedures with categories and ownership
- **Materials**: Inventory items with categories, pricing, and stock levels
- **Candidates**: Hiring pipeline stages from Applied to Hired/Rejected
- **Campaigns**: Marketing campaigns with platform, spend, and lead tracking
- **Jobs**: Project pipeline from Lead to Completed
- **Feature Requests**: User feedback and feature suggestions
- **Integrations**: Third-party service connection states
- **Customer Messages**: Customer-to-company messaging with status tracking (unread/read/replied)
- **Work Requests**: Customer service requests with service type, urgency, and status workflow
- **Custom Forms**: Dynamic form builder with flexible JSONB field definitions (job applications, W-9, etc.)
- **Form Submissions**: User responses to custom forms with admin review workflow

### Role-Based Access Control
- **Master Admin**: Designated via `isMasterAdmin` flag; only master admin can grant Admin role or delete/modify protected accounts
- **Admin**: Full access to all features including user management, company settings, inbox, and admin panel (except cannot modify master admin)
- **Manager**: Team features plus access to customer inbox
- **Crew**: Basic operational features (SOPs, Materials, Jobs, Hiring)
- **Customer**: Dedicated portal for messaging, work requests, and customer resources; can request role upgrades

### Access Request System
- Users can request role upgrades through the Customer Portal "Account Access" card
- Access requests go to Admin Panel "Access Requests" tab for review
- Only master admin can approve requests for Admin role
- Approved requests automatically update the user's role

### Registration Security
- All new public registrations default to Customer role (hardcoded)
- Admins can manually create users with other roles via Admin Panel

### Build System
- **Dev Server**: Vite for frontend with HMR
- **Production Build**: 
  - Vite builds frontend to `dist/public`
  - esbuild bundles server to `dist/index.cjs`
- **Path Aliases**: 
  - `@/` → `client/src/`
  - `@shared/` → `shared/`
  - `@assets/` → `attached_assets/`

### Authentication Flow
1. Session-based authentication with HTTP-only cookies
2. Protected routes redirect unauthenticated users to `/auth`
3. Admin-only endpoints use `requireAdmin` middleware
4. Password recovery via email tokens

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **connect-pg-simple**: Session storage in PostgreSQL

### Frontend Libraries
- **@tanstack/react-query**: Data fetching and caching
- **shadcn/ui + Radix UI**: Accessible UI component primitives
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Animation library
- **Recharts**: Data visualization charts
- **@hello-pangea/dnd**: Drag and drop functionality

### Backend Libraries
- **Express**: Web server framework
- **Passport + passport-local**: Authentication
- **Drizzle ORM**: Database queries and schema management
- **Zod**: Runtime validation

### Development Tools
- **Vite**: Frontend bundler and dev server
- **esbuild**: Server bundler for production
- **Drizzle Kit**: Database migration tooling
- **TypeScript**: Type checking across full stack

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: (Recommended for production) Secret for session encryption. Sessions will NOT persist across server restarts without this

### Form Builder
- Admin-only form creation with drag-and-drop field builder
- 8 field types: text, textarea, number, email, date, select, checkbox, radio
- Draft/published workflow with access level controls
- Admin-only submission viewing

### Help System
- Interactive walkthroughs for new users with role-specific paths
- FAQ section with expandable answers
- Step-by-step dialogs guiding users through features

### User Profiles
- All users can create and edit their own profile
- Profile fields: name, email, phone, bio
- Profile picture upload with cloud storage (Replit Object Storage)
- Accessible from navigation sidebar for all user roles

### AI Assistant
- Powered by Replit AI Integrations (OpenAI)
- Conversation history stored per user in database
- Streaming responses via Server-Sent Events (SSE)
- Routes: /api/conversations (list, create, delete), /api/conversations/:id/messages (send)
- Chat storage: conversations and chat_messages tables with userId association

### Employee Portal
- Personal Profile: contact info, department, emergency contact
- Address & Contact: mailing address management
- Payroll & Taxes: direct deposit, W-4 withholding settings
- Health Insurance: benefits overview with enrollment status
- Vacation & Time Off: PTO balances and request form
- Route: /employee or /employee-portal

### Integrations Hub
- Status: Work in Progress (Coming Soon overlay)
- Planned integrations: QuickBooks, CompanyCam, Jobber
- Route: /integrations