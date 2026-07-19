# Repository Architecture

This document captures the current architecture of the repository as discovered from the codebase. It is a documentation-only summary and does not propose changes.

## Repository Architecture

This is a Next.js 14.2.5 application using the App Router.

It is a mixed server/client application with:
- Server-rendered route pages and API handlers
- Client-side UI for interactive behavior
- PostgreSQL via Prisma
- Credentials-based authentication via NextAuth v5
- Event data loaded from local JSON files and normalized into a single feed

The app currently has two main product surfaces:
- A public viewer experience at [app/page.js](../app/page.js)
- A private admin experience at [app/admin/page.js](../app/admin/page.js)

There is no custom provider layer, no React context system, and no middleware file. The root layout in [app/layout.js](../app/layout.js) is the only shared layout.

## Folder Structure

- [app/](../app/)
  - Route pages: [app/page.js](../app/page.js), [app/admin/page.js](../app/admin/page.js), [app/login/page.js](../app/login/page.js), [app/chat/page.js](../app/chat/page.js)
  - API routes: [app/api/](../app/api/)
  - Global styles: [app/globals.css](../app/globals.css), [app/Events.module.css](../app/Events.module.css)

- [components/](../components/)
  - Viewer/admin UI modules: [components/ViewerApp.js](../components/ViewerApp.js), [components/EventsSection.js](../components/EventsSection.js), [components/AdminConsole.js](../components/AdminConsole.js), [components/CalendarView.js](../components/CalendarView.js), [components/ProfileView.js](../components/ProfileView.js), [components/AchievementsView.js](../components/AchievementsView.js), [components/EventsMap.js](../components/EventsMap.js), [components/EventAlerts.js](../components/EventAlerts.js), [components/PushSetup.js](../components/PushSetup.js)

- [lib/](../lib/)
  - Core utilities and services: [lib/db.js](../lib/db.js), [lib/session.js](../lib/session.js), [lib/loadEvents.js](../lib/loadEvents.js), [lib/normalize.js](../lib/normalize.js), [lib/platform.js](../lib/platform.js), [lib/achievementsEngine.js](../lib/achievementsEngine.js), [lib/googleCalendar.js](../lib/googleCalendar.js), [lib/useNotifications.js](../lib/useNotifications.js)

- [prisma/](../prisma/)
  - Schema and migrations: [prisma/schema.prisma](../prisma/schema.prisma)

- [data/](../data/)
  - Event source JSON files

- [public/](../public/)
  - Manifest, service worker, fallback images, and icons

## Route Map

### Public
- [app/page.js](../app/page.js)
  - Viewer feed
  - Authentication optional
  - Uses [components/ViewerApp.js](../components/ViewerApp.js)

- [app/login/page.js](../app/login/page.js)
  - Credentials login and signup page
  - Redirects to admin or home based on role

- [app/chat/page.js](../app/chat/page.js)
  - Public family group chat feed
  - Read-only for visitors

### Viewer
- [app/page.js](../app/page.js)
  - Public viewer experience with event cards, favorites, profile, and feed filters

### Admin
- [app/admin/page.js](../app/admin/page.js)
  - Admin-only dashboard
  - Uses [components/EventsSection.js](../components/EventsSection.js)

### API
- Auth routes: [app/api/auth/[...nextauth]/route.js](../app/api/auth/[...nextauth]/route.js), [app/api/auth/signup/route.js](../app/api/auth/signup/route.js), [app/api/me/route.js](../app/api/me/route.js)
- Admin curation: [app/api/admin/event-meta/route.js](../app/api/admin/event-meta/route.js), [app/api/admin/manual-event/route.js](../app/api/admin/manual-event/route.js)
- Interactions: [app/api/interactions/route.js](../app/api/interactions/route.js), [app/api/track/route.js](../app/api/track/route.js)
- Calendar and Google: [app/api/auth/google/route.js](../app/api/auth/google/route.js), [app/api/auth/google/callback/route.js](../app/api/auth/google/callback/route.js), [app/api/calendar/push/route.js](../app/api/calendar/push/route.js)
- Posts/chat: [app/api/posts/route.js](../app/api/posts/route.js)
- Push: [app/api/push/subscribe/route.js](../app/api/push/subscribe/route.js), [app/api/push/send/route.js](../app/api/push/send/route.js)
- Achievements: [app/api/achievements/route.js](../app/api/achievements/route.js)

## Authentication Flow

Authentication is implemented with NextAuth v5 credentials auth in [auth.js](../auth.js).

Flow:
1. User lands on [app/login/page.js](../app/login/page.js)
2. Login uses NextAuth sign-in with email/password
3. Signup creates a new user with role VIEWER via [app/api/auth/signup/route.js](../app/api/auth/signup/route.js)
4. Session is JWT-based and includes user id and role
5. Server-side helpers in [lib/session.js](../lib/session.js) read the session
6. Admin-only routes and pages use requireAdmin

Notable details:
- No middleware is used
- Protected behavior is enforced in route handlers and page loaders, not by a global guard
- The login page redirects based on role after fetching [app/api/me/route.js](../app/api/me/route.js)

## Role System

### Admin
- Role value: ADMIN
- Access:
  - [app/admin/page.js](../app/admin/page.js)
  - Admin-only API routes under [app/api/admin/](../app/api/admin/)
  - Google Calendar OAuth routes and calendar push
  - Posting to family chat
  - Event meta curation and manual event creation

### Viewer
- Role value: VIEWER
- Access:
  - Public viewer feed
  - Save/favorite interactions
  - Personal achievements and calendar state
  - Push subscriptions

### Anonymous
- No session
- Can browse public events and trigger view tracking
- Cannot save events or access admin features

Role enforcement is centralized in [lib/session.js](../lib/session.js) and enforced in specific server routes.

## Database Structure

The Prisma schema in [prisma/schema.prisma](../prisma/schema.prisma) defines:

- User
  - Authentication fields: email, passwordHash, role
  - Google OAuth fields: googleConnected, googleRefreshToken, googleAccessToken, googleTokenExpiry
  - Relationships to interactions, subscriptions, views, posts, achievements

- EventInteraction
  - One row per user + event
  - Tracks attended, saved, calendar, shared, posted, and views

- PushSubscription
  - Web push device subscriptions

- EventView
  - Tracks event opens/views, either by user or anonymous cookie ID

- EventMeta
  - Admin curation state per event: suggested, hidden, contentIdeaKey

- ContentIdea
  - Curated themes that can be attached to events

- ManualEvent
  - Admin-created events with draft/publish state

- Post
  - Public family group chat posts

- Achievement
  - Weekly achievement state per user and achievement key

## Event Flow

Data flow:
1. Event JSON files in [data/](../data/)
2. [lib/loadEvents.js](../lib/loadEvents.js) reads and loads them
3. [lib/normalize.js](../lib/normalize.js) normalizes and filters them
4. [lib/config.js](../lib/config.js) provides source mappings, neighborhoods, priorities, and fallback settings
5. The processed events are passed to:
   - [components/ViewerApp.js](../components/ViewerApp.js) for the public viewer
   - [components/EventsSection.js](../components/EventsSection.js) for the admin dashboard

Viewer/admin interaction flow:
- User clicks an event → [app/api/track/route.js](../app/api/track/route.js) stores a view
- Signed-in user saves/attends/etc. → [app/api/interactions/route.js](../app/api/interactions/route.js)
- Achievements recompute via [lib/achievementsEngine.js](../lib/achievementsEngine.js)

## UI Component Hierarchy

### Global Layout
- Root shell from [app/layout.js](../app/layout.js)
- Shared styles from [app/globals.css](../app/globals.css) and [app/Events.module.css](../app/Events.module.css)

### Shared UI Building Blocks
- Event cards and feed sections
- Panels, empty states, buttons, filters, tabs
- Map panel via [components/EventsMap.js](../components/EventsMap.js)
- Alerts and notifications via [components/EventAlerts.js](../components/EventAlerts.js) and [components/PushSetup.js](../components/PushSetup.js)

### Role-specific UI
- Viewer: [components/ViewerApp.js](../components/ViewerApp.js)
- Admin: [components/EventsSection.js](../components/EventsSection.js) and [components/AdminConsole.js](../components/AdminConsole.js)

## Shared Components

### Shared Layouts
- Root layout only: [app/layout.js](../app/layout.js)

### Shared Components
- [components/EventsMap.js](../components/EventsMap.js)
- [components/EventAlerts.js](../components/EventAlerts.js)
- [components/PushSetup.js](../components/PushSetup.js)
- [components/AchievementsView.js](../components/AchievementsView.js)
- [components/CalendarView.js](../components/CalendarView.js)
- [components/ProfileView.js](../components/ProfileView.js)

### Shared Hooks
- [lib/useNotifications.js](../lib/useNotifications.js)

### Shared Utilities
- [lib/loadEvents.js](../lib/loadEvents.js)
- [lib/normalize.js](../lib/normalize.js)
- [lib/platform.js](../lib/platform.js)
- [lib/session.js](../lib/session.js)
- [lib/achievementsEngine.js](../lib/achievementsEngine.js)

### Shared Services
- [lib/googleCalendar.js](../lib/googleCalendar.js)
- [lib/db.js](../lib/db.js)

## Viewer Components

The current viewer experience is centered around [components/ViewerApp.js](../components/ViewerApp.js), which handles:
- Hero and main feed
- Favorites view
- Profile view
- Bottom navigation
- Sign-in and sign-out

Other viewer-facing pieces:
- [components/CalendarView.js](../components/CalendarView.js) for saved/planned events
- [components/AchievementsView.js](../components/AchievementsView.js) for weekly progress
- [components/EventsMap.js](../components/EventsMap.js) for location-based display

Notable limitation:
- There is no dedicated search experience, distance-based filtering, or separate events page; the current viewer UI is feed-first with date and neighborhood filtering.

## Admin Components

The admin experience is centered on:
- [components/EventsSection.js](../components/EventsSection.js)
  - Dashboard shell
  - Event feed for Julie
  - Filter chips and date sorting
  - Notifications and calendar links
  - Bottom navigation

- [components/AdminConsole.js](../components/AdminConsole.js)
  - Event management
  - Suggest/hide controls
  - Content idea assignment
  - Draft/publish workflow
  - Theme performance metrics
  - Family chat posting

The admin app is structured as one console-style dashboard rather than a separate multi-page admin app.

## Potential Risks

- Authentication is not enforced by middleware; it depends on per-route/server checks.
- The app has no provider/context architecture, so state is mostly passed through props.
- Admin and viewer experiences are split by separate entry points, which can create drift.
- The database layer is central to nearly every feature, so changes there affect many surfaces.
- Viewer protections rely on server-side checks; future routes must remember to enforce them.
- The event system is driven by local JSON files plus Prisma, not a full CMS or external event service.

## Safe Files To Modify

These appear to be the least risky surfaces for UI or feed behavior changes:
- [app/page.js](../app/page.js)
- [app/admin/page.js](../app/admin/page.js)
- [components/ViewerApp.js](../components/ViewerApp.js)
- [components/EventsSection.js](../components/EventsSection.js)
- [components/AdminConsole.js](../components/AdminConsole.js)
- [components/EventsMap.js](../components/EventsMap.js)
- [lib/loadEvents.js](../lib/loadEvents.js)
- [lib/normalize.js](../lib/normalize.js)
- [lib/config.js](../lib/config.js)
- [app/Events.module.css](../app/Events.module.css)

## Files That Should Never Be Modified

These are the core architectural boundaries and should be treated as protected:
- [auth.js](../auth.js)
- [lib/session.js](../lib/session.js)
- [lib/db.js](../lib/db.js)
- [prisma/schema.prisma](../prisma/schema.prisma)
- [app/api/auth/[...nextauth]/route.js](../app/api/auth/[...nextauth]/route.js)
- [app/api/admin/event-meta/route.js](../app/api/admin/event-meta/route.js)
- [app/api/admin/manual-event/route.js](../app/api/admin/manual-event/route.js)
- [app/api/interactions/route.js](../app/api/interactions/route.js)
- [app/api/track/route.js](../app/api/track/route.js)
