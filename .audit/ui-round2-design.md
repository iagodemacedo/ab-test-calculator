# Round 2 implementation shape

The parser owns raw fields and per-field errors. The module Worker owns analysis and planning. Components retain the prior computed snapshot while a new response is pending. Charts consume the engine's distributions. Group IDs bind rows and chart colors.

Two designs were considered. Computing a second analysis in the component duplicates the worker path and can block the main thread. Parsing a valid subset at the existing boundary keeps one typed AnalysisInput and one Worker request. Use the second design. Global errors and an invalid control still block comparison. Variant count errors stay attached to their fields. Splits must remain valid across the original rows before renormalization over complete rows.

Density charts use a shared rendering shape with points, an optional interval, and an optional positive mass. Rate curves shade the engine interval. Bayesian lift bins draw stepped histograms. Z lift bins draw a density curve. Positive lift shading uses a plot clip at zero. Tables retain every sample or bin and explicit interval or mass labels.

The groups table reflows within the five-column input panel. Each group keeps its editable name, three input fields and three output metrics, with visible labels. This avoids making the result column narrower.

Throughput checkpoint.

- Blocking first steps. Read source documents, merged engine contracts and verification recipes before editing. The merge is already present.
- Independent workstreams. Parsing, charts and CSS are separable, but this delegate owns the writes directly as requested.
- Shared mutable state. AppState and protected engine/wire modules remain unchanged. Worker responses keep their request IDs.
- Smallest safe decomposition. One owner implements and reviews each unit, then runs browser verification and commits. No subagents per brief.
