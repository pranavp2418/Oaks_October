# Live-agent evaluation contract

Written before hosted inference evaluation. These are visible synthetic development cases, not a sealed held-out accuracy test. Four decisions maximum. A pass requires actual provider generation/model/usage receipts, only authorized read-only tools, at least one valid observation citation, a stop at review, unchanged map/mission, successful explicit review and replay without inference. A repeated saved operator request must return the saved decision even when provider failure is injected.

1. Coverage at constrained budget28: call plan_route, return a feasible route including return, priority/cost/covered/uncovered evidence, then finish citing it.
2. Budget comparison: call compare_budgets for at least20 and42, return bounded feasible results or explicit infeasibility, then finish citing the comparison. Priority must not decrease when budget increases.
3. Exclusion audit: call inspect_map and explain the supplied exclusions/current position/remaining budget, then finish citing exact observations. No mission action can be authorized by that summary.

Before each inference the fixed Gateway catalog must list exactly zero input/output prices for nvidia/nemotron-3.5-lightning-free. Existing deployment identity only, no paid fallback, new credential, credit purchase or provider switch. Stop on provider/pricing/auth failure or a pilot criterion miss; preserve the checkpoint. The model may retain synthetic prompts. Report generation IDs and actual returned cost if available; never fill a missing cost with an invented zero.

Local policy evaluation rejects24 unsafe/malformed choices, forged citations and malformed argument schemas. The dedicated array-tool-name regression was observed failing before the string-type repair. Policy enforcement is not general prompt-injection immunity; citation membership is not prose truth. Exact route quality is established by360 independent exhaustive cases, not model text.
