### Claude Implementation Prompt

Implement the UI shown in the attached mockups as the new production design for the application. This is not a redesign of the product architecture—only the user interface, navigation, authentication flow, and viewer experience should change. Keep the existing backend, APIs, database models, and event management logic wherever possible.

The application should feel like a premium Philadelphia lifestyle platform inspired by Julie's photography and Instagram presence. The design should be warm, cinematic, editorial, and photography-first, using elegant typography, soft shadows, rounded cards, cream backgrounds, warm olive accents, and subtle glassmorphism. Avoid cartoon styling, bright gradients, oversized icons, or anything that feels playful or game-like. The photography should always be the focus.

Database

I accidentally reset the database, which removed Julie's account and credentials.

Please recreate and reseed the database with the original admin account.

Restore:

Julie's admin user Original email Original password Admin role Permissions Seed events Any required demo data so the application is immediately usable. ### User Roles

There are now three application roles.

### Anonymous Viewer

Does not sign in.

Can:

Browse events Browse neighborhoods View maps Favorite events locally Open the sidebar View event details

Cannot:

Access admin features Edit anything Save favorites to the database View analytics Signed-in Viewer

Everything anonymous users can do plus:

Persistent favorites Likes Calendar sync Profile Saved preferences Julie (Admin)

Julie continues using the original admin dashboard.

Do **NOT** replace her dashboard with the viewer interface.

She should still have:

**CRUD** Analytics Priority pinning Content mapping ### Most Viewed Event management Dashboard analytics Existing sidebar tools

Only modernize the visual styling to match the new design language.

### Shared Home Page

The Home page shown in the mockup becomes the landing page for:

Anonymous users Signed-in users Julie

The content changes slightly depending on role, but the layout remains consistent.

Header

The hero image currently makes smaller text difficult to read.

Instead of placing text directly on top of the hero image, create a dedicated header area **ABOVE** the hero image.

The header should **NOT** overlap or cover the photograph.

The image should remain fully visible underneath.

Structure:

Header

↓

### Hero Image

↓

Filters

↓

Content

Inside the header place:

Hamburger menu Julie's Event logo Notification bell Greeting (if signed in) Optional profile shortcut

The header should use a transparent or lightly frosted background and maintain the cinematic feel without obscuring the photography.

Sidebar

The sidebar should continue existing exactly as it does today.

It should be available for:

Anonymous users Signed-in users Julie

Keep every existing sidebar feature.

Only restyle it to match the new visual language.

### Hero Section

Use the attached hero style.

Large Philadelphia lifestyle photography.

Warm editorial color grading.

Large headline.

Subtitle.

Primary **CTA**.

Minimal overlay.

Photography should dominate.

Filters

The filters should **NOT** be inside the header.

Place them underneath the hero.

For anonymous users add an Area filter.

Area filter options:

### All Areas

Fairmount Brewerytown ### University City

These should filter events immediately.

Additional sorting:

Soonest Dates Newest ### Home Page Sections

Below the filters display:

### Interactive Map

Show nearby events.

Display:

User location Event pins Cluster counts Tap to expand

Switch between:

### Map View

### List View

### Event Feed

Each event card should include:

Large thumbnail Date Title Neighborhood Time Description Distance from user Tags

Actions:

Save Like Add to Calendar

Distance examples:

0.4 mi

1.8 mi

Walkable

10 min drive

### Save Banner

For anonymous users, keep the *Save your favorites* call-to-action encouraging sign-in.

Signed-in users should not see this banner.

### Events Page

This page follows the second attached mockup.

It is available **ONLY** for signed-in viewers.

Julie does not use this interface.

Anonymous users should not have an Events tab or direct access to the Events page.

Instead, they browse events through the Home page.

The Events page should contain:

Short hero

Filters

Large searchable event list

Every event card should match the supplied design.

### Event Filters

Include:

Search

Soonest

Newest

Date

Neighborhood

Area

Distance

Category

Tags

Allow selecting multiple tags simultaneously.

Suggested tags:

Sports

Food

Coffee

History

Markets

Museums

Parks

Outdoor

Nightlife

### Dog Friendly

Family

Music

Arts

Fitness

Cycling

Community

Free

### Hidden Gems

### Event Cards

Every card includes:

Image

Date

Priority badge

Title

Neighborhood

Time

Description

Distance

Tags

Actions:

Save

Like

Add to Calendar

Cards should feel premium with generous spacing and strong typography.

Maps

Every event should include coordinates.

Allow:

View on Map

Directions

Distance calculation

Travel estimate

Bottom sheet map preview

### Bottom Navigation

### Anonymous Viewer

Only show:

Home

Favorites

Profile

Do **NOT** show an Events tab.

Signed-in Viewer

Show:

Home

Events

Calendar

Favorites

Profile

Julie

Keep the existing admin navigation.

Authentication

Anonymous users can browse immediately.

Signing in upgrades their experience without changing the layout.

Julie should continue logging into the admin experience using the restored seeded credentials.

### Technical Notes

Preserve existing APIs whenever possible. Do not break the admin dashboard. Reuse existing event models. Lazy load images. Virtualize long event lists. Use Framer Motion for subtle animations. Maintain responsive behavior across all device sizes. Keep components modular and reusable. The viewer-facing interface should feel like a polished consumer application, while Julie's admin experience remains a powerful management tool with the same underlying functionality.

The final result should closely match the attached mockups while providing a seamless experience for anonymous visitors, signed-in users, and Julie as the administrator. The emphasis should be on beautiful photography, discoverability, intuitive navigation, and making Philadelphia neighborhoods and events feel inviting and inspiring.