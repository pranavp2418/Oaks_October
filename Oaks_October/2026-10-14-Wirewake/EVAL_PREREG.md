# Before hosted model evaluation

Three visible development integration cases, not a held-out accuracy benchmark:

- Shortest disagreement: require check_equivalence for the supplied handshake and exact connect/read witness.
- Failure reduction: require minimize_trace on the supplied longer trace; verify every reduced trace with Go and one-deletion minimality.
- Repair explanation: require suggest_patch; validate suggested edge/proof through Go, with no model-approved mutation.

Each case must use actual generation receipts and tokens, at most4 decisions, inspectable citations and human review. Import/model state remains unchanged by the investigator. Inject provider failure after a saved checkpoint, resume, and repeat the original operation ID without another inference. Restore saved decisions without model calls. Record per-case failures rather than adjusting labels to manufacture success. Provider prose is not an independent correctness oracle. Cost missing from a receipt is not recorded as zero.
