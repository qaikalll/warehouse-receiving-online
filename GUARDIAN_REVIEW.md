# Receiving App Guardian — continuation review

Historical checkpoint report. See **PRODUCTION_READINESS.md** for the subsequent production-readiness continuation and current blockers.

Status: **DRAFT — not deployed, not production ready.** Continue this exact repository; do not replace the application or blindly deploy the candidate rules.

## A. Recovered interruption point

The working files are based on `qaikalll/warehouse-receiving-online` main commit `53b7b804a82bf2096b84c833b49d005803dda081` (22 September 2026). The interrupted run had written Guardian and its integration, with 29 passing local tests. Browser verification, Firestore rules verification, release evidence, and a remote review checkpoint were unfinished. The continuation rechecked the local diff and unchanged remote main before editing. No project was recreated. The separate old Sites prototype was inspected during discovery and left unchanged.

## B. Already written before this continuation

- Canonical server-read profile authentication, role watchdog, removal of inferred-role writes at login, and push-token writes that do not mutate access fields.
- Guarded transaction operations, per-record locks, bounded retry, retained operation IDs for uncertain outcomes, optimistic edit checks, and server readback before success.
- Receiving milestone validation; guarded Receiving, Booking, Discrepancy and Return writes; DO reservation documents; atomic role/audit writes and bounded bulk deletion.
- Draft retention, isolated render functions, incidents, active-session health checks and an Admin-only panel.
- Safer service-worker response caching, regression harness, draft rules and a release evidence check.

These were existing local edits, not a deployed Guardian.

## C. Work completed in this continuation

- Corrected Return script cache versions and aligned the page/service-worker URLs.
- Invalid/unconfirmed authoritative profiles remain unhealthy. Denied mutations now reach incident reporting. Finished operations no longer accumulate indefinitely in the retry map.
- Fixed queued subscription callbacks reintroducing privileged data after access revocation. Added session/identity checks to main data, Return and Admin Booking subscriptions and date/session checks to availability callbacks. Clear dashboard, detail and account views when a session is invalidated.
- Extended black-box incidents with safe document references, previous/attempted permission or milestone state, response codes and Guardian action; passwords, tokens, photos and raw business payloads are excluded.
- Added server-confirmed incident history and module health reads to the existing Admin panel.
- Added canonical DO reservation keys that can be checked by Firestore rules, including rejection of a forged alternative key. Candidate rules require reciprocal valid booking slots and reject partial bookings.
- Completed the browser test harness, Firestore emulator tests and lockfile-based CI. Release evidence is bound to the current source digest.

## D/E. Confirmed source-code defects and fixes

| Source defect | Consequence | Fix / evidence |
|---|---|---|
| FCM registration copied stale role/company/active values into the user profile | Could overwrite current Admin or access settings | Only notification fields are written; executed stale-profile regression |
| Login inferred roles from legacy profiles and proceeded after denied profile writes | UI permissions could differ from canonical database permissions | Canonical UID server profile only, fail closed, no login role writes |
| Save Role passed a CSS selector to an ID lookup | Selected role could be ignored | `querySelector`, browser role-change/audit test |
| Milestone form timestamps changed before confirmed save | Failed write appeared to advance Receiving | Form milestones update only after transaction and server readback |
| New discrepancy IDs were generated on repeated submits | Double clicks/retries could create duplicates | Retained draft ID and locked guarded write |
| Independent parallel deletes | Partial deletion on one failed write | Bounded transaction; large deletion fails closed |
| Service worker cached bad/non-static responses and returned HTML for JS failures | Stale state and misleading client errors | Successful same-origin responses only; no HTML fallback for JS |
| Late subscription callback reapplied old rows after session containment | Revoked-session data reappeared in UI | Epoch/identity checks; reproduced and fixed in browser simulation |
| Return script URL was not bumped with changed code | Older cached Return implementation could remain | Page/service-worker version regression |

These establish defect mechanisms; historical production incidents have not been forensically attributed without production logs.

## F/G. Protections and deterministic recovery

Verified in local simulations: canonical role verification, client edit denial, role+audit atomicity, write confirmation, safe retries for transient failures, duplicate-request protection, stale-edit conflict rejection, milestone sequencing, atomic rollback on rejection, token refresh followed by retry, render isolation, incident persistence/readback and offline asset handling.

Unknown failures are contained and recorded. Guardian never rewrites production code or restores Admin privileges from an old browser snapshot. A timeout remains outcome-unknown and locked while its write is pending. Recovery is recorded only after the relevant retry/operation verifies successfully. A delayed successful operation may require reopening the record to resynchronize the form; the UI does not invent success.

## H. Executed verification

All tests use synthetic data; no production records or accounts were modified.

| Verification | Result and scope |
|---|---|
| `npm test` | 33/33 passing: core failure simulations, executed FCM regression, integration assertions and service worker tests |
| `npm run test:rules` | 8/8 passing against real Firestore emulator / candidate rules, demo project only |
| `npm run test:browser` | Chromium browser with deterministic Firebase test double; see scenarios below. Not a staging or live Firebase test |
| Syntax and whitespace | Changed JS parsed; `git diff --check` clean |
| `npm run check:release` | Correctly returns failure: required production evidence is absent |

Browser scenarios: Admin login/panel; refresh/relogin and Admin persistence; rejected database write preserves form/milestones and logs incident; health/history; Arrived → Start → Complete; edit completed Receiving; held-write double submit produces one record; selected role and audit commit; Discrepancy save; existing Return save; role revocation clears session data; Client restrictions; Booking creates slot and Receiving; no uncaught exceptions across those scenarios.

Core failure coverage additionally includes transient API/network retries, token expiry, lost acknowledgement, verification failure, stuck write timeout, stale edit, invalid dates/quantities/status transitions, duplicate reservation, linked discrepancy validation, atomic write failure and unrelated render isolation.

Rules scenarios additionally include direct self-promotion/tenant-change attempts, role update without audit, immutable audit, forged reservation IDs, invalid slot, rejected client edits and cross-company reads. Expected `PERMISSION_DENIED` output is part of those tests.

## I. Remaining risks / unfinished production work

1. **Existing production rules are unavailable.** The candidate is deliberately not configured as a production deployment target. It may omit existing server collections, functions, indexes, FCM requirements or legitimate workflows. Never replace live rules without comparison and staging tests.
2. **Existing profiles and data need review, backup and migration.** Canonical UID profiles must exist and agree with approved roles/companies. Candidate rules require explicit active profiles. Legacy receiving records need canonical DO reservations/backfill and duplicate reconciliation before the rules can be enabled. Missing profiles fail closed; Guardian will not invent an Admin.
3. **Candidate server validation is incomplete.** Calendar-valid dates/advance-notice timezone, exhaustive Return item validation and configuration schemas need production business/schema confirmation. Browser validation is not a security boundary. Existing booked Receiving edits/deletes also need a coordinated slot lifecycle and staging review.
4. **Deletion graph concurrency needs a backend design.** Selected writes are atomic, but a concurrently added discrepancy can fall outside a previously selected cascade set. Large deletion is blocked. A trusted transactional parent revision/link-count or server maintenance operation is needed before claiming complete graph integrity.
5. **Firebase Auth creation plus Firestore profile creation is cross-service.** If profile creation fails after Auth succeeds, an identity can need manual reconciliation. Guardian reports the incident and never automatically deletes an uncertain identity.
6. **24/7 server monitoring and configuration recovery are not implemented.** Health checks run in the visible active browser session. Closed-browser incidents, privileged console/Admin SDK mutations and configuration backups require trusted server infrastructure. Role audit/incident history preserves evidence; there is no blind automatic privilege rollback.
7. **Telemetry is best effort.** If the session is invalid or rules/network deny incident persistence, the panel displays unconfirmed logging. Client-supplied incident records are not tamper-proof forensic evidence; centralized trusted logging/retention remains necessary.
8. **Real authentication, mobile/PWA upgrade, notifications and complete staging acceptance remain unverified.** Mock login does not prove real token revocation/refresh behavior. The emulator does not prove the currently deployed rules are safe.
9. **Repository release enforcement is not yet configured.** The added workflow fails closed, but cannot itself stop an independent Pages deployment or direct main push. Branch protection and the actual Pages deployment must require the checks. No claim is made that production is already protected by the gate.

## J. Required human/environment intervention

Provide an export of the currently deployed Firestore rules and the intended staging Firebase configuration/access. Confirm the authoritative user profiles/approved protected roles, booking timezone policy, and relevant server functions. An owner must verify a database backup, review migration/backfill, run staging acceptance, and configure required branch/Pages deployment checks. No passwords should be pasted into this report.

After that, continue from this branch: compare/merge rules, implement the remaining backend invariants, dry-run migrations against a backup, rerun tests and staging acceptance, then review release evidence. Do not merge this draft merely because local tests pass.

The release evidence file (or `GUARDIAN_RELEASE_EVIDENCE` path) requires `sourceDigest` from `node scripts/release-gate.cjs --digest`, plus a verified entry for each key listed in that script. Every entry needs `passed: true`, a genuine evidence reference, reviewer and date. Evidence must describe actual checks, not placeholders. Ignored evidence can be supplied as a reviewed CI artifact or intentionally added after validation. Changes to source invalidate the digest.

## K. Preservation

The existing application, routes, UI, role types, Receiving, Booking, Calendar, Discrepancy and Return modules remain. Source edits are confined to Guardian integrations and related defect fixes. No existing database records were edited, no existing users or workflows were deleted, and no production deployment was made. Other repository files are preserved by creating the review tree from the exact remote base tree. The tested simulated workflows pass; full production compatibility remains subject to the explicit staging gates above.
