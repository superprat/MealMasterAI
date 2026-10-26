# Meal Planner Application

## Overview

This is a full-stack meal planning application built with React, Express, and TypeScript. The application allows users to plan their weekly meals, track nutritional goals, and get AI-powered meal suggestions. It features a modern UI built with shadcn/ui components and integrates with Anthropic's Claude AI for intelligent meal planning recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

**CRITICAL: Data Safety Policy**
- NEVER run DELETE commands on the database without EXPLICIT user authorization
- Always ask permission before removing any user data
- Tests should clean up their own data, but only with user approval
- User data is sacred - protect it at all costs

## Recent Changes

### Mobile Best Practices Implementation (August 11, 2025)
- ✅ Made sticky action buttons always visible on mobile for all modals
- ✅ Enhanced Add Recipe Modal with sticky form submission buttons  
- ✅ Enhanced Edit Recipe Modal with sticky form submission buttons
- ✅ Enhanced AI Suggestions Modal with sticky Apply/Cancel buttons
- ✅ Improved Recipe Selector (mobile sheet) with sticky Cancel button
- ✅ Increased touch targets on Recipe Library action buttons (9x9 on mobile vs 8x8 on desktop)
- ✅ Enhanced Dialog component base class with better mobile height handling
- ✅ Added comprehensive test-ids for better mobile testing automation
- ✅ All modals now use mobile-first responsive design with proper scrollable content areas

### Calendar Date Calculation Bug Fix (August 11, 2025)
- ✅ Fixed critical date mismatch bug in 4-day calendar view
- ✅ Calendar now correctly displays dates based on the actual week being viewed
- ✅ Fixed meal addition to save to the correct day of the correct week
- ✅ Improved date formatting to calculate dates relative to weekStartDate
- ✅ Added test data cleanup procedures for better testing hygiene

### Session Persistence Fix for Deployments (August 10, 2025)
- ✅ Fixed session persistence issue that required users to re-login after each deployment
- ✅ Updated session store configuration to use PostgreSQL when DATABASE_URL is available
- ✅ Sessions now persist across all deployments and server restarts
- ✅ Extended session duration to 7 days for better user experience
- ✅ Automatic session table creation in PostgreSQL database
- ✅ Improved environment detection logic independent of NODE_ENV setting

### Comprehensive End-to-End Testing with Playwright (August 10, 2025)
- ✅ Built complete Playwright testing framework covering all core functionality
- ✅ Created 6 comprehensive test suites: API Integration, Frontend Integration, Authentication, Meal Planning, Recipe Library, Responsive Design
- ✅ Implemented 40+ individual test cases covering complete user workflows and API endpoints
- ✅ Added custom test runners with intelligent reporting and browser dependency handling
- ✅ API tests validate all 10 endpoints, authentication, data integrity, and error handling (10/10 passing)
- ✅ Frontend integration tests cover complete user journeys, modal interactions, form validation, and responsive behavior
- ✅ Tests include screenshot capture for visual verification across device sizes
- ✅ Authentication helpers ensure reliable test account login for consistent UI testing
- ✅ Integrated with development workflow for continuous quality assurance

### Alternative Meal Suggestion Functionality (August 10, 2025)
- ✅ Added "Different" buttons to AI meal suggestions for requesting alternatives to specific meals
- ✅ Replaced AI-powered alternative suggestions with recipe library-based alternatives  
- ✅ Implemented local recipe filtering by meal type with exclusion tracking
- ✅ Added automatic reset when all available recipes for a meal type have been shown
- ✅ Provides instant alternative suggestions without AI API calls for better performance

### Multi-Family Account System (August 2, 2025)
- ✅ Implemented complete multi-family account system with database-driven authentication
- ✅ Different passwords provide access to isolated family meal plans and targets
- ✅ Recipes remain shared across all families for consistency
- ✅ Migrated existing data (37 meal plans, 1 weekly target) to "Default Family" automatically
- ✅ Added family name display in header with logout functionality across all pages
- ✅ Cleaned up login interface by removing demo family details
- ✅ Families are created via the SEED_FAMILIES env var (see README)

### Production Session Store Fix (July 30, 2025)
- ✅ Fixed production MemoryStore warning that could cause memory leaks
- ✅ Implemented PostgreSQL-backed session storage using connect-pg-simple
- ✅ Sessions now persist across server restarts and scale across multiple instances
- ✅ Automatic session table creation in database
- ✅ Fallback to MemoryStore in development environment

### Drag and Drop Recipe Management (July 30, 2025)
- ✅ Implemented full drag and drop functionality for moving recipes between meal slots
- ✅ Visual feedback with green highlight when dragging over valid drop zones
- ✅ Works across different days and meal types (breakfast, lunch, dinner, snack)
- ✅ Automatic meal plan updates and calendar refresh after moves
- ✅ Prevents dropping on same slot and handles move operations seamlessly

### 4-Day Calendar View Fix (July 30, 2025)
- ✅ Fixed calendar to show current date + next 3 days instead of weekly view
- ✅ Corrected date calculation logic for proper date display
- ✅ Updated navigation to move forward/backward by 4 days instead of 7
- ✅ Fixed date formatting to show correct consecutive dates

### Mobile-Optimized Recipe Selection (July 27, 2025)
- ✅ Implemented different "Add Recipe" behavior for mobile vs desktop devices
- ✅ Desktop: Shows compact dropdown with search functionality and hover effects
- ✅ Mobile: Shows full-screen bottom sheet for easier touch interaction
- ✅ Added mobile detection using useIsMobile hook for responsive behavior
- ✅ Enhanced recipe list with better spacing and touch targets on mobile
- ✅ Improved search input sizing - larger on mobile for better usability
- ✅ Click-outside-to-dismiss only active on desktop (natural swipe-to-dismiss on mobile)
- ✅ Consistent search functionality and "no results" messaging across both interfaces

### Mobile Responsive Design Implementation (July 26, 2025)
- ✅ Implemented comprehensive mobile responsive design across all components
- ✅ Added xs breakpoint (475px) to Tailwind CSS configuration for extra small screens
- ✅ Updated header navigation with responsive button layouts and icon-only mobile versions
- ✅ Redesigned meal calendar with mobile-friendly stacked layout by day
- ✅ Enhanced add recipe modal with responsive form layouts and touch-friendly controls
- ✅ Updated weekly overview and daily macro summary with mobile grid layouts
- ✅ Made recipe library fully responsive with adaptive grid and filter controls
- ✅ Optimized all text sizes and spacing for mobile readability
- ✅ Ensured all interactive elements are touch-friendly on mobile devices

### ESM Deployment Fix (July 25, 2025)
- ✅ Fixed "Dynamic require of memorystore is not supported" deployment error
- ✅ Replaced memorystore with express-session's built-in MemoryStore for ESM compatibility
- ✅ Removed memorystore dependency to resolve bundling issues
- ✅ Fixed TypeScript iterator compatibility issues for ESM bundling
- ✅ Resolved file naming case sensitivity conflicts (Login.tsx vs login.tsx)
- ✅ Fixed undefined DAYS variable reference in components
- ✅ Verified successful build and deployment with esbuild ESM format

### Password Protection & Authentication (July 25, 2025)
- ✅ Enabled password protection for testing and production
- ✅ Created favicon with SVG and PNG formats  
- ✅ Fixed production login navigation issues with improved session handling
- ✅ Added session persistence with MemoryStore for reliability
- ✅ Implemented proper redirect handling using window.location.replace()
- ✅ Enhanced session save mechanism with callback confirmation

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite with custom configuration for development and production

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **API Design**: RESTful API with structured error handling
- **AI Integration**: Anthropic Claude API for meal suggestions

### Data Storage Solutions
- **Database**: PostgreSQL with Neon serverless provider
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Type-safe database schema with Zod validation
- **Storage Interface**: Abstract storage interface with DatabaseStorage implementation
- **Migrations**: Drizzle Kit for database migrations and schema sync

## Key Components

### Database Schema
The application uses three main tables:
- **Recipes**: Stores recipe information including nutritional data, meal type, and usage limits
- **Meal Plans**: Maps recipes to specific days/meals in weekly plans
- **Weekly Targets**: User's daily nutritional goals (calories, protein, carbs, fats)

### Frontend Components
- **MealCalendar**: Weekly grid view showing planned meals
- **MealCard**: Individual meal slot with add/remove functionality
- **WeeklyOverview**: Summary of weekly nutritional progress
- **DailyMacroSummary**: Daily breakdown of macro nutrients
- **AIRecommendationModal**: Interface for AI-powered meal suggestions

### API Endpoints
- Recipe CRUD operations (`/api/recipes`)
- Meal plan management (`/api/meal-plans`)
- Weekly macro calculations (`/api/macros`)
- Nutritional targets (`/api/targets`)
- AI meal suggestions (`/api/ai/generate-meal-plan`)

## Data Flow

1. **User Interaction**: User selects a week and views the meal calendar
2. **Data Fetching**: React Query fetches meal plans, recipes, and macro data
3. **Meal Planning**: Users can add/remove meals from their weekly plan
4. **AI Suggestions**: Users can request AI-powered meal recommendations
5. **Progress Tracking**: Real-time updates to nutritional progress and weekly targets

## External Dependencies

### AI Integration
- **Anthropic Claude**: Latest model "claude-sonnet-4-20250514" for meal plan generation
- **Features**: Recipe suggestions, meal plan optimization, nutritional analysis

### UI Framework
- **shadcn/ui**: Complete component library with consistent theming
- **Radix UI**: Accessible primitives for complex components
- **Tailwind CSS**: Utility-first styling with custom design system

### Development Tools
- **Vite**: Fast development server with HMR
- **TypeScript**: Full type safety across frontend and backend
- **Replit Integration**: Custom plugins for development environment

## Deployment Strategy

### Development
- **Hot Reload**: Vite development server with middleware integration
- **Environment**: Express server serves API and Vite handles frontend
- **Database**: Development database with Drizzle schema synchronization

### Production
- **Build Process**: Vite builds frontend to static assets, esbuild bundles server
- **Static Assets**: Frontend served as static files from Express
- **Database**: PostgreSQL with connection pooling via Neon
- **Environment Variables**: DATABASE_URL and optional API keys managed securely
- **Host Configuration**: Server binds to 0.0.0.0 for proper deployment
- **Error Handling**: Comprehensive async error handling with production logging
- **Health Check**: /health endpoint for deployment monitoring

### Architecture Decisions

**Monorepo Structure**: Single repository with shared types and schemas between frontend and backend for better type safety and code reuse.

**Drizzle ORM**: Chosen for its TypeScript-first approach and excellent type inference, providing better developer experience than traditional ORMs.

**TanStack Query**: Selected for its powerful caching, background updates, and optimistic updates capabilities, essential for a responsive meal planning interface.

**Database Storage Pattern**: Implemented storage interface abstraction with PostgreSQL database backend for persistent data storage and scalability.

**AI Integration Design**: Structured prompts and response parsing to ensure consistent and useful meal recommendations from Claude API.