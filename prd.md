Product Requirements Document (PRD)
Product Name: SpotSkill (Working Title)
1. Overview
Problem Statement
Millions of skilled informal workers (cobblers, electricians, plumbers, street food vendors, babysitters, etc.) are not digitally discoverable because they lack smartphones, apps, or technical knowledge. Existing platforms like Urban Company focus mainly on bookable professionals, not street-level, instantly available local workers.

Users currently discover such workers only by physically searching nearby, which is inefficient and unreliable.

Solution (MVP Scope)
A location-based discovery website where users can:

• Find nearby skilled workers
• View workers sorted by distance, ratings, and reviews
• Add new workers by uploading photo + location
• See worker availability status
• See "Might not be available" tag after inactivity

Supports categories like:

• Cobblers
• Electricians
• Plumbers
• Babysitters
• Street food vendors

2. Goals and Success Criteria
Primary Goal
Enable users to discover nearby skilled workers in real-time and contribute new worker listings.

Success Criteria (Hackathon MVP)
Functional:

• User can view nearby workers based on location
• User can add a worker with image + category + location
• Workers sorted by distance + rating
• Reviews and ratings can be added
• "Might not be available" tag appears after inactivity

Technical:

• Deployable web app
• Real-time database integration
• Location detection works
• Image upload works

Deployment success = live URL accessible

3. Target Users
Primary:

• People looking for quick nearby services
• Students, residents, travelers

Secondary:

• Community contributors adding worker info

Workers themselves are NOT required to register in MVP.

4. Key Differentiator vs Urban Company / Joboy
Urban Company = booking platform
SpotSkill = discovery platform

Urban Company requires:

• worker registration
• service booking
• scheduling

SpotSkill enables:

• discover informal workers instantly
• crowdsourced worker discovery
• supports street workers without smartphones

Unique MVP Differentiators:

Crowdsourced worker addition

Supports informal workers

Street food discovery layer

Availability inferred via inactivity

No booking required

5. Core Features (Strict MVP)
Feature 1: Location Detection
User opens website

System:

• detects location via browser GPS
• OR user enters location manually

Output:

List of nearby workers sorted by:

• distance
• rating

Priority: CRITICAL

Tech Feasible: YES

Feature 2: Worker Listing Display
Each worker card shows:

• image
• category
• distance
• rating
• reviews count
• availability tag

Availability logic:

If last confirmed activity > 7 days:

Show:

"Might not be available"

Priority: CRITICAL

Feature 3: Add Worker (Crowdsourcing)
User can add worker with:

Fields:

• Image upload
• Category (dropdown)
• Name or title
• Optional description
• Location (auto capture)
• Optional contact

Stored in database.

Priority: CRITICAL

Feature 4: Ratings and Reviews
Users can:

• rate worker (1–5 stars)
• add text review

System stores:

• rating average
• review count

Priority: IMPORTANT

Feature 5: Availability Tag Logic
Database field:

last_verified_at

Update when:

• worker added
• review added
• worker viewed (optional)

If current_date − last_verified_at > 7 days

Show tag:

"Might not be available"

Priority: IMPORTANT

Implementation feasible via frontend logic.

Feature 6: Category Filtering
User can filter by:

• plumber
• cobbler
• electrician
• babysitter
• street food

Priority: IMPORTANT

6. Out of Scope (for 10-hour MVP)
DO NOT BUILD:

• authentication
• worker login
• booking system
• payments
• chat
• notifications
• admin dashboard

These are future features.

7. User Flow
Flow 1: Discover Worker
User opens site
→ location detected
→ nearby workers shown
→ sorted by distance + rating
→ user views worker

Flow 2: Add Worker
User clicks "Add Worker"
→ uploads image
→ selects category
→ submits

Worker visible immediately

Flow 3: Review Worker
User opens worker
→ adds rating + review

Database updates average rating

8. Technical Architecture (Hackathon Optimized)
Simple architecture only.

Frontend:
HTML
CSS
JavaScript

Recommended: simple React OR plain JS

Backend / Database:
Supabase

Provides:

• database
• image storage
• APIs
• deployment support

Maps:
OpenStreetMap or Google Maps API (optional)

Distance calculation:
Haversine formula (frontend)

9. Database Schema
Table: workers

Fields:

id
name
category
image_url
latitude
longitude
description
rating_avg
rating_count
last_verified_at
created_at

Table: reviews

id
worker_id
rating
review_text
created_at

10. Core Business Logic
Distance calculation
Frontend calculates:

distance between user and worker

Sort by:

distance ASC
rating DESC

Availability logic
Frontend checks:

if current_time − last_verified_at > 7 days

Show:

"Might not be available"

No backend cron needed.

Rating logic
When review added:

new_avg =
(old_avg * count + new_rating) / (count + 1)

Update in workers table.

11. UI Requirements (Minimal)
Pages:

Home page

Contains:

• location detect button
• category filter
• worker cards
• add worker button

Add worker page

Contains:

• image upload
• category dropdown
• submit button

Worker details modal

Contains:

• image
• reviews
• add review button

12. Deployment Plan (Fastest Method)
Recommended:

Frontend:

Deploy on:

Vercel

Backend:

Supabase hosted

Image storage:

Supabase Storage

Total deployment time:

30 minutes

13. Tech Stack (Strict MVP)
Frontend:

HTML / CSS / JavaScript
OR React (optional)

Backend:

Supabase

Database:

PostgreSQL via Supabase

Storage:

Supabase Storage

Deployment:

Vercel

Maps (optional):

OpenStreetMap

14. Development Plan (10-Hour Breakdown)
Hour 1–2:

Setup Supabase
Create tables
Setup frontend project

Hour 3–4:

Implement location detection
Fetch workers

Hour 5–6:

Implement add worker feature
Image upload

Hour 7:

Implement ratings and reviews

Hour 8:

Implement availability tag logic

Hour 9:

UI cleanup
Sorting logic

Hour 10:

Deploy

15. Risks and Mitigations
Risk: No workers initially
Mitigation: preload 10 dummy workers

Risk: Location permission denied
Mitigation: manual location entry

Risk: Image upload complexity
Mitigation: use Supabase Storage