# 🚫 DO NOT TOUCH

This document defines the protected areas of this repository.

These areas are considered production-critical.

Unless I explicitly instruct you otherwise, DO NOT modify, refactor, delete, rename, or replace any of the following.

---

# Primary Rule

The Admin Dashboard is OFF LIMITS.

Your work is ONLY for the Viewer Experience.

There are effectively two applications inside this repository:

1. Admin Application (Julie's Dashboard)
2. Viewer Application (Public Website/App)

Only work on #2.

---

# Protected Areas

Do NOT modify:

- Admin Dashboard UI
- Admin Dashboard Layout
- Admin Navigation
- Admin Analytics
- Admin CRUD
- Admin Event Management
- Admin Settings
- Admin Authentication Flow
- Admin Sidebar
- Admin Components
- Admin Charts
- Admin Reports
- Admin Priority System
- Admin Content Mapping
- Admin "Most Viewed" analytics
- Admin Forms
- Admin Tables

If you discover these share components with the Viewer UI, do NOT rewrite them.

Instead:

- extend them
- compose around them
- create new viewer-specific components

Never break admin functionality.

---

# Protected Routes

Any route intended only for Julie.

Examples include:

/admin

/dashboard

/admin/events

/admin/settings

/admin/users

/admin/analytics

/admin/content

/admin/map

/admin/profile

Any route protected by:

role === "admin"

or

isAdmin()

is considered protected.

---

# Protected Components

Unless absolutely necessary, do NOT edit:

AdminLayout

DashboardLayout

Sidebar

AnalyticsCard

StatCard

Chart Components

Priority Components

CRUD Forms

Admin Tables

Management Components

Anything used only by the dashboard.

---

# Protected Logic

Do NOT modify:

Authentication

Authorization

Permissions

Session handling

JWT logic

Middleware

Database connection

Prisma configuration

ORM configuration

API authentication

Business logic

Event ingestion

Analytics calculations

Content mapping

Priority calculations

Unless a change is absolutely required to support the Viewer UI.

If changes are required, they MUST remain backwards compatible.

---

# Protected Database Behavior

Do NOT change existing:

tables

relations

models

permissions

roles

queries

unless instructed.

Only ADD new functionality.

Never remove existing functionality.

---

# Viewer Scope

You ARE allowed to modify:

Public Homepage

Public Event Page

Viewer Navigation

Viewer Layouts

Viewer Components

Viewer Cards

Maps

Favorites

Calendar

Likes

Search

Filtering

Distance calculations

Hero Sections

Photography

Typography

Animations

Public Profile

Sign In experience

Anonymous experience

---

# Shared Components

If you discover that the Admin and Viewer use the same component:

DO NOT rewrite it.

Instead choose ONE of these options:

1. Create a Viewer version.

Example:

EventCard

↓

ViewerEventCard

2. Wrap the existing component.

3. Extend it with optional props.

Never break the Admin experience.

---

# Before Editing Any File

Ask yourself:

Does this affect Julie's dashboard?

If YES

STOP.

Find another solution.

---

# If You Are Unsure

Do NOT guess.

Instead:

1. Explain why the file may be shared.

2. Explain the risks.

3. Recommend a safer alternative.

Then wait for approval.

---

# Goal

The Admin Dashboard should behave EXACTLY the same after your work is complete.

Julie should not notice any difference except that the public Viewer application now has a new UI.

If the Admin Dashboard changes unexpectedly, you have gone outside the intended scope.

---

# Priority Order

Always prioritize work in this order:

1. Preserve Admin functionality
2. Preserve existing backend logic
3. Reuse existing APIs
4. Extend existing components
5. Build new Viewer components
6. Match the supplied UI mockups

Never sacrifice stability for aesthetics.

---

# Golden Rule

If a change could potentially impact Julie's ability to manage events, publish content, view analytics, or administer the platform:

DO NOT TOUCH IT.

Find a Viewer-only solution instead.