# BEFORE YOU WRITE ANY CODE

Do NOT immediately begin modifying files.

Your first task is to fully understand this repository before making any changes.

I have included a `.codex` folder in this repository. Read EVERYTHING inside that folder first. Treat it as the project's documentation and source of truth.

Your workflow should be:

---

## Phase 1 — Repository Discovery

Read the following before making any edits:

- the entire `.codex` directory
- README.md
- package.json
- next.config.*
- middleware.*
- prisma schema (if applicable)
- authentication implementation
- routing structure
- app router/pages router structure
- component hierarchy
- layout components
- providers
- existing event models
- user models
- permissions
- role system
- navigation components
- shared UI components
- API routes related to authentication and events

Your goal is to understand:

- how authentication currently works
- how roles are implemented
- how navigation is built
- how layouts are shared
- how events are loaded
- where viewer pages begin
- where admin pages begin
- what components are reusable
- what should NOT be modified

Do not assume anything.

Read first.

---

## Phase 2 — Produce a Context Report

Before writing code, generate a report that explains:

### Project Architecture

- framework
- routing strategy
- authentication library
- database
- ORM
- styling system
- component library
- folder structure

### Authentication

Explain:

- how users sign in
- how sessions work
- where roles are stored
- current permissions
- middleware

### Admin Dashboard

Identify:

- every admin route
- admin layout
- admin components

These files are OFF LIMITS unless absolutely required for compatibility.

### Viewer Side

Identify:

- public routes
- viewer layouts
- event components
- navigation
- reusable cards

### Potential Risks

Identify any files that affect both admin and viewer experiences.

---

## Phase 3 — Wait

After producing the report:

STOP.

Do not begin implementing anything until your understanding is complete.

If something is unclear, ask questions instead of guessing.

---

# Scope

Your work is LIMITED to the viewer experience.

You are NOT redesigning the application.

You are NOT rebuilding authentication.

You are NOT touching the admin dashboard.

You are NOT changing APIs unless absolutely necessary.

---

# DO NOT MODIFY

Anything under the admin dashboard.

Anything related to:

- analytics
- admin CRUD
- admin event management
- priority tools
- admin navigation
- admin layouts
- admin styling

Unless fixing a shared component that affects both experiences.

If a shared component must change, make the change backward compatible.

---

# ONLY MODIFY

The public-facing experience.

Specifically:

Anonymous Viewer UI

Signed-in Viewer UI

These include:

- Home page
- Events page
- Favorites
- Calendar
- Profile
- Shared viewer navigation
- Viewer event cards
- Viewer map
- Viewer filters

---

# Preserve Existing Logic

Do NOT rewrite:

authentication

database schema

API routes

business logic

event fetching

unless absolutely necessary.

Prefer reusing existing services.

---

# Design Goal

The viewer experience should match the supplied mockups.

Photography-first.

Warm.

Editorial.

Premium.

Philadelphia lifestyle.

Julie's branding.

---

# Code Quality

Prefer extending existing components over replacing them.

Avoid duplication.

Keep components reusable.

Follow existing project conventions.

Respect the current architecture.

---

# Final Rule

Understanding the repository is more important than writing code quickly.

Read first.

Understand second.

Plan third.

Implement last.

Never guess.