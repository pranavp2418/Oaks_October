# Loadstone acceptance contract

Exact finite-horizon battery/generator dispatch with SOC and ramp state, bounded integer DP and action reconstruction

1. Validated profile import and transactional local workspace
2. Exact dispatch solver with conservation and terminal reserve
3. Outage and tariff scenario comparison
4. Version-bound plan review and approval
5. Checkpointed dispatch rehearsal with failure/resume and duplicate guards
6. Digest-bound audit export and operating cost/SOC view

No real customer/physical infrastructure control. Synthetic fixtures. Database transaction, revision, repeated request and failure checks must pass. Public source contains no private inspiration details. Scorecard gates: core correctness; durable state; real integration; failure recovery; workload/evaluation; complete operator workflow; clean build/source/release. Finance/healthcare/education extra-depth rule is not applicable to these selected domains.
