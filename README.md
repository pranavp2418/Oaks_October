# Oaks_October

October 2026 software projects by **Pranav Chirag Patel**. Theme: property operations and adjacent workflows.

Each project lives directly under its title: `Oaks_October/Project-Title/`. Frontend, backend, tests, documentation, and deployment configuration belong together inside that folder.

## Project index

| Project | Purpose | Stack | Status | Live demo |
|---|---|---|---|---|
| [WorkOrder Triage](./WorkOrder-Triage) | Transparent maintenance prioritization and trade routing | JavaScript, Node.js, HTML/CSS | Deployed; core live flow verified | [Open demo](https://oaksoctober1002.vercel.app/) |

WorkOrder Triage is a deployment dry run, not part of the daily intermediate/advanced project count. Its queue persists only in the current browser. It does not use Supabase.

## Collection plan

- Target: two distinct projects per build day, one directly related to backend/full-stack/AI implementation and one adjacent.
- Rotate languages and problem domains; avoid repackaging the same app.
- Overall target mix: 60% intermediate and 40% advanced.
- Label independent feature concepts honestly; inspiration does not imply affiliation with a company.
- Before reporting a project complete: test its main user flow, error handling, backend integration, and public deployment; document limitations and reproduction steps.
- Keep project and build status explicit. Failed or blocked deliveries are not complete projects.
- Prepare daily source/demo links, test results, and LinkedIn copy for review. LinkedIn publishing is not connected or automated.

## Automation status

Daily Project Build Cycle is enabled for October 2, 2026 through May 1, 2027, near 7 p.m. America/Chicago (within one hour). It is instructed to build, deploy, verify and report two projects per run, with blockers reported honestly. The first scheduled run has not yet been verified; this is a target, not a guarantee of 424 completed projects.

[PROJECT_LEDGER.json](./PROJECT_LEDGER.json) is the durable project/verification index. No daily portfolio projects are counted yet. Supabase is excluded pending account-email verification. LinkedIn output is draft-only; publishing is not connected. Never commit credentials or production customer data.

## Dry-run verification — October 2, 2026

The original repository now drives Vercel project `oaks_october_1002`, root `WorkOrder-Triage`. Commit `8d15e3015de13ca3faf69b5fef19ef8f2fb77ddd` triggered production deployment `dpl_frxpX3Gohib9b6mpFDMT67xFSdv6`. Verified public page load, backend health, request creation with urgent scoring and explanation, resolve/reload persistence, resolved filter, reopening, and fictional sample loading. Policy and API-handler tests passed locally. CSV download verification timed out in the browser and is not claimed as verified; live invalid-input API behavior was not separately tested.
