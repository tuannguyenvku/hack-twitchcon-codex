import { ScenarioSchema, type Decision } from "../../shared/protocol.js";
export interface Context {
  roundId: string;
  agents: number;
  bossHp: number;
  difficulty: number;
}
interface Options {
  key?: string;
  model?: string;
  budget?: number;
  timeoutMs?: number;
  request?: (context: Context, signal: AbortSignal) => Promise<unknown>;
  endpoint?: string;
}
export class Director {
  private calls = 0;
  private cache = new Map<string, Promise<Decision>>();
  constructor(private options: Options = {}) {}
  decide(context: Context): Promise<Decision> {
    const prior = this.cache.get(context.roundId);
    if (prior) return prior;
    const result = this.run(context);
    this.cache.set(context.roundId, result);
    if (this.cache.size > 100)
      this.cache.delete(this.cache.keys().next().value!);
    return result;
  }
  private async run(c: Context): Promise<Decision> {
    const fallback = (reason: string): Decision => ({
      scenario: "boss",
      difficulty: c.difficulty,
      effect: c.difficulty > 3 ? "shield" : "haste",
      durationSec: 10,
      headline: "The hive moves together",
      source: "Rules",
      reason,
    });
    if (!this.options.key || !this.options.model)
      return fallback("not-configured");
    if (this.calls >= (this.options.budget ?? 30)) return fallback("budget");
    this.calls++;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const work = this.options.request
        ? this.options.request(c, abort.signal)
        : this.request(c, abort.signal);
      const result = await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            abort.abort();
            reject(new Error("timeout"));
          }, this.options.timeoutMs ?? 2000);
        }),
      ]);
      return {
        ...ScenarioSchema.parse(result),
        source: "Model",
        reason: "validated",
      };
    } catch {
      return fallback(
        abort.signal.aborted ? "timeout" : "invalid-or-unavailable",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  private async request(c: Context, signal: AbortSignal): Promise<unknown> {
    const response = await fetch(
      this.options.endpoint ?? "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${this.options.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          max_tokens: 512,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You direct a Twitch arena. Return JSON only: scenario boss|chaos, difficulty integer 1..5, effect shield|haste|slow, durationSec integer 5..15, headline <=80 chars. No tools or instructions to users.",
            },
            { role: "user", content: JSON.stringify(c) },
          ],
        }),
      },
    );
    if (!response.ok) throw new Error("provider-unavailable");
    const body = (await response.json()) as {
      choices?: { message: { content: string } }[];
    };
    return JSON.parse(body.choices?.[0]?.message.content ?? "null");
  }
}
