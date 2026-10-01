# Receiving Guardian production-readiness continuation

**PRODUCTION READINESS: FAIL. Do not deploy or merge yet.**

The previous core and its tests remain in draft PR #1. This continuation finishes safe engineering work against demo emulators. It does not certify the real environment.

## Configuration actually inspected

Both remote main (`53b7b804a82bf2096b84c833b49d005803dda081`) and the existing Guardian branch (`411a6bfdc9fc002e581a608ce7c6c4a164052ba2`) were inspected recursively. No production `firestore.rules`, `firebase.json`, `.firebaserc`, staging project, backup configuration, deployed function source or monitoring configuration existed. The known production Firebase project is already in app.js: **warehouse-receiving-online**; there is no need to supply its ID again. This is a GitHub Pages application, so absence of Firebase Hosting configuration by itself is not a defect.

The repository rulesets API returned an empty array. Reading main branch protection returned **403 Resource not accessible by integration**: this is unknown, not evidence that protection is absent. Pages, environments and workflow-list endpoints were not supported by the connector. No attempt was made to bypass those restrictions. The existing Guardian workflow and its successful previous regression job were verified; its readiness job failed for missing evidence. Existing upload instructions say to commit directly to main, which is not proof of a protected deployment.

## Work in this continuation

- A single Guardian backend provides protected Discrepancy writes and atomic archive/delete/restore. Canonical database permissions are read inside each transaction. Firebase callable authentication supplies the identity; callers cannot grant themselves a role in a payload.
- Every linked Discrepancy mutation writes its parent's concurrency version. Deletion reads parents and linked queries in its transaction. A concurrent creation either commits before the deletion and is archived/deleted, or loses the race and fails on the missing parent. Direct client writes/deletes that would bypass the fence are denied by candidate rules.
- Persistent operation receipts make retries idempotent. Deletion tombstones block stale recreation. Replaying a save after its record was subsequently deleted does not report it as currently saved.
- Deletion archives original records, linked discrepancies, booking slots and DO claims in the same transaction. Restore is Admin-only, checks archive hashes and completeness, refuses to overwrite live data, and changes the restored edit version. These per-operation archives are **not a substitute for a verified managed Firestore backup**.
- Offline migration planning finds duplicate DOs, invalid records/profiles, broken links and missing booking slots. It never guesses roles or activation. Apply/replay/rollback are explicitly restricted to `demo-*` emulators. Source hash checks reject stale plans; rollback rejects later edits. Large plans fail before writing and need reviewed batches.
- Candidate Receiving rules validate real calendar dates, ISO timestamps, required fields, numeric bounds, actor UID/email, company access, DO claims, milestones and reciprocal booking slots. Client bookings enforce next-day notice in Malaysia (UTC+8); the existing one-slot-per-30-minutes capacity is preserved.
- The scheduled backend monitor runs every five minutes after an approved deployment. It checks service reads, approved role/Auth invariants, repeated failures and unresolved critical client incidents. Incidents are deduplicated by check. Recovery needs a fresh passing probe. A missing role baseline is UNVERIFIED, not HEALTHY. The monitor does not rewrite business data or automatically restore privileges.
- A disabled candidate heartbeat-absence alert is supplied for owner review. It needs a real notification channel and an alert-delivery test; it is not active. No message was sent to anyone.

## Cutover requirements

`guardian-config.js` deliberately has `functionsRegion: null`. Protected Discrepancy/deletion actions fail closed in this draft until the backend is deployed separately and that public region is configured. The browser tests use an explicit test double override. Do not publish this branch's frontend alone.

`firebase/guardian.deploy.candidate.json` is a review configuration, not the production rules or an environment alias. No default production target was created. Functions have a readiness predeploy hook; this cannot protect an independent Pages push or a manually invoked rules deploy. The entire real deployment pipeline must be verified separately. No deploy command has been run.

Safe rollout order after independent approval: verified backup and restore drill; non-production configuration; compare/merge actual production rules; approved profile/data dry-run; reviewed migration rehearsal; deploy/test callable backend in staging; verify monitoring heartbeat and alert delivery; configure the frontend region; test rules/frontend/backend as a single staging release; enforce branch and Pages checks. Only then may a separately authorized production rollout occur. Keep incompatible old clients from writing during the coordinated cutover.

Never roll back only the frontend to a version that directly writes Discrepancy while the new rules require callables. A production rollback plan must name a compatible frontend/backend/rules set and prove it in staging.

## Missing evidence: exact owner action

| Missing item | Why needed | Where to obtain it | Supply this, without secrets |
|---|---|---|---|
| Currently published Firestore rules | Candidate compatibility cannot be inferred from frontend source | Firebase console → warehouse-receiving-online → Build → Firestore Database → Rules | Copy the **published** rules into `firestore.production.rules.txt`, with database ID and last publication date |
| Staging environment facts | Real auth, indexes, SDK calls and coordinated rollout remain unverified | Firebase console project selector; project owner/developer | Existing staging project ID and public web configuration, database ID/location, deployed function region. If none exists, say “no staging”; no password/key needed |
| Approved profile/data migration inspection | Legacy role/data compatibility and duplicate reconciliation are unknown | Project owner runs a read-only inspection/export locally | Redacted validation results: canonical UID/profile counts, unresolved issues, source digest, reviewed migration plan digest. Do not send passwords, tokens or service-account JSON |
| Managed backup + restore drill | Operation archives cannot recover a project-wide loss | Google Cloud console → Firestore → Databases → select database → backup/PITR settings | Backup resource ID, creation time, retention/PITR settings, successful isolated restore operation ID and target database/project; never restore over production for testing |
| Branch/Pages enforcement | Connector cannot verify admin settings and no repository rulesets were returned | GitHub repository → Settings → Rules/Branches; Settings → Pages; Actions deployment workflow | Screenshots/export showing required checks, bypass settings, Pages source and the workflow's deployment dependencies |
| Monitoring activation | Scheduler/IAM, heartbeat and alert delivery do not exist in source evidence | Google Cloud → Cloud Scheduler, Cloud Run/Functions, Logging and Monitoring → Alerting | Job name/region, recent successful executions/heartbeat, approved role baseline review, notification-channel resource ID and successful alert test. Channel ID is not a credential |
| Compatible rollback release | Main commit alone is not proof of what is currently deployed | GitHub Pages deployment history plus Firebase release history | Last known good deployed SHA and compatible rules/backend release IDs, with staging rollback result |

A managed Firestore backup/restore reference: https://firebase.google.com/docs/firestore/backups
Scheduled function reference: https://firebase.google.com/docs/functions/schedule-functions

## Test evidence and gate

Local final run on 2026-10-01:

- Unit/regression: **35/35 PASS** (`npm test`).
- Firestore candidate rules and trusted server integration: **33/33 PASS** (`npm run test:rules`), on demo emulators only. Includes concurrent creation/deletion, competing editors, archive failure rollback, restore collision/replay checks, migration rollback, monitor recovery, Receiving completion and atomic booking reschedule.
- Chromium browser: **13 scenario outputs PASS**, no uncaught page exceptions. Uses the Firebase test double; this does not prove real Auth/Functions integration.
- Syntax and `git diff --check`: PASS.
- Actual HTTP Auth/Functions integration: **blocked locally**, because the execution sandbox rejects the Functions runtime Unix socket (`EPERM`). Three tests are included in GitHub CI; no local pass is claimed.
- Final release gate: **FAIL as intended**, missing source-matching production evidence. Existing local passing tests are listed above; an absent signed-off evidence record is not a failed test result.

GitHub CI **regression job PASS** for code commit `505b212b2bb02767e5551f5071934bce2c746b41`: all 35 regression tests, 33 rules/server emulator tests, 13 browser scenario outputs and **3/3 real HTTP Auth/Functions emulator integration tests** passed. The HTTP tests verify anonymous/Client rejection, authenticated save/replay/delete/restore, and database role recheck with a still-valid older token. The separate **production-readiness job FAIL** is confirmed from its logs: required production evidence is missing.

Evidence: https://github.com/qaikalll/warehouse-receiving-online/actions/runs/36800422234
Existing draft PR: https://github.com/qaikalll/warehouse-receiving-online/pull/1

The prior run stopped after Guardian core and local/CI core verification (33 regression, 8 rules emulator, 13 browser scenario outputs), before production configuration, backend concurrency protection, migration rehearsal and unattended monitoring. That existing core was preserved. This continuation adds a trusted transaction boundary where it was missing; it does not reconstruct the app.

Additional confirmed defects were frontend enumeration unable to exclude concurrently created linked records, stale restore/save receipts being mistaken for current success, missing atomic booking-slot movement on date edits, and Client workspace controls remaining enabled until the first subscription response. The new regression cases exercise those mechanisms. Historical production incidents still cannot be attributed without production logs.

No unrelated feature, UI page, or existing record was removed. No production deploy, data migration, rule replacement, role change, backup restore or GitHub settings change was performed. The branch requires coordinated backend/rules/frontend setup and remains unsuitable for standalone frontend deployment.

The release gate requires source-matching, dated evidence for production rules, profiles, migrations, restore, integration, monitoring, branch protection and Pages deployment enforcement. Passing emulators does not substitute for those records. Missing evidence remains a failure. No production records, rules, settings or deployments have been modified.
