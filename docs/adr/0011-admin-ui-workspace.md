# ADR-0011: Admin UI workspace

**Status:** Accepted
**Date:** 2026-04-21
**Linear:** [BAC-5](https://linear.app/bidon/issue/BAC-5/investigate-ui-improvements-to-simplify-ad-unit-creation), recorded in [BAC-127](https://linear.app/bidon/issue/BAC-127/admin-ui-rebrand-adr)

---

## Context

Configuring an app used to mean a separate list, new, show, and edit page for the app, its demand profiles, its auction configurations, and its line items. Records that belong together were on different screens, so building an auction was a tour of the sidebar. Show pages also held fields the edit page did not.

[BAC-5](https://linear.app/bidon/issue/BAC-5/investigate-ui-improvements-to-simplify-ad-unit-creation) asked to keep related information on one screen and to try combining view and edit. The visual rebrand that shipped in the same pass is [ADR-0010](0010-admin-ui-rebrand.md).

## Decision

`/apps/:id` is the workspace for one app. The page loads the app, its demand profiles, its auction configurations, and its line items together. Create, edit, clone, and delete for those children happen inline on that page (`AppDemandProfilesSection`, `AppAuctionConfigurationsSection`, and the inline forms). You do not leave the app to add a profile, a configuration, or a line item.

An auction configuration is a set of network sections, split into bidding networks and waterfall networks. Line items sit inside the network they belong to. `NetworkAccordion` is gone.

A demand source's accounts live on `/demand_sources/:id`, created and edited inline. `/demand_source_accounts` redirects to `/demand_sources`.

The sidebar is three groups: **Apps**, **Global Configuration** (demand sources, segments), and **Settings** (users, API credentials, passwords). Auction configurations, line items, demand profiles, demand source accounts, and countries are not navigation items. The list, new, show, and edit routes for line items, auction configurations, and demand profiles still exist. They are not the setup flow. Passing `app_id` and `ad_type` into those standalone new pages was reverted once creation moved inline.

The lists that stay in the sidebar are card grids (`ResourcesGrid` / `AppsGrid`): apps, demand sources, segments, users, and API keys. Countries stay on `ResourcesTable`.

Rejected: leaving auction setup as four independent CRUD areas. Also rejected: sending the operator from the app page to a pre-filled standalone new page and back. Also rejected: a network accordion as the auction editor, and a sidebar entry for every API resource.

## Consequences

- A change to how an auction, a line item, or an app demand profile is configured belongs on the app page. A new top-level screen for that work recreates the hop the workspace removed.
- Do not wire the app page back to `/line_items/new`, `/app_demand_profiles/new`, or `/v2/auction_configurations/new`. Those routes are leftover entry points.
- A child collection hangs off its parent page, the way accounts hang off a demand source. The parent stays highlighted in the sidebar.
- New sidebar entries are for records that are not the children of an app or a demand source. Countries stay out of the nav.
- Apps, demand sources, segments, users, and API keys are browsed as cards. Line items, auction configurations, and demand profiles keep their old tables only on the routes the sidebar does not link.
