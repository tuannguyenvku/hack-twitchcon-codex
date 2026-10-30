# TwitchHive inference cost envelope

The MVP has no paid tier or payment processing. Cheers/subscriptions are Twitch-originated cosmetic events, never purchased voting power.

The deterministic per-viewer policy has zero model cost regardless of agent count. Director requests occur only once per round, maximum 30 per session, with roughly 250 input tokens (aggregate context + instructions; actual usage must be measured) and at most 512 output tokens.

For the chosen OPENROUTER_MODEL, let input price be I and output price O in USD per million tokens. Conservative planning cost per round is `(250*I + 512*O)/1,000,000`; per capped session is at most 30 times that estimate. Tokenization/context overhead varies; use provider-reported usage to reconcile actual cost. No model pricing or positive revenue figures are assumed. Do not enable a model whose planned round cost exceeds $0.005 until multiple candidate models have been benchmarked and documented.

Rules baseline: no paid requests, exact replay reproducibility. Model candidate: same aggregate round fixtures, measure valid-schema rate, deadline success (<2 seconds), cost and whether scenario variety improves observed stream experience. Local tests exercise a real HTTP provider fixture and invalid/timeout responses; they do not benchmark paid models or establish model quality. Production inference remains opt-in through environment configuration; Rules is the default experience.
