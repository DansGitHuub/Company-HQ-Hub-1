---
name: Offer accept behavior
description: The candidate-facing offer acceptance endpoint no longer auto-fires the hire flow. Admin must explicitly convert via the Hiring Kanban.
---

## Rule
`POST /api/offer/:token/accept` saves signature + `offerAcceptedAt`, moves stage to `"Offer Accepted"`, and notifies admin. It does NOT call `executeHireFlow()`.

## Why
Feature A/B implementation added an explicit admin conversion step. Candidates can also decline or submit counter-proposals before admin acts. Auto-hiring skipped admin review.

## How to apply
- Employee creation is only triggered by `POST /api/candidates/:id/hire` (admin action).
- Two paths trigger that endpoint: (1) admin drags card to "Hired" on Kanban → existing `handleHireConfirm`, (2) admin clicks "Convert to Employee" on "Offer Accepted" card → `handleConvertConfirm`.
- The candidate's confirmation screen (OfferAcceptancePage.tsx) no longer shows login credentials or auto-redirects to /auth.
- New pipeline stages: "Offer Accepted" (green-500), "Negotiating" (amber-500), "Offer Declined" (red-500, hidden by default).
- New DB columns on candidates: offer_declined_at, offer_decline_reason, offer_counter_note, offer_counter_submitted_at (all nullable, no default).
