// Per-cycle view of the agent's daily token budget, enforced in code on
// every iteration — never by prompt instruction.
//
// `spentToday` is the API's figure when the cycle started; this adds what
// the cycle itself has spent since, because the API's number doesn't move
// until the next /runtime read. One Durable Object per agent plus the
// in-flight guard in agent.ts means no other cycle for this agent spends
// concurrently, so a local running total is accurate for the cycle.
export class BudgetGuard {
  private spentThisWake = 0;

  constructor(
    private readonly dailyTokenLimit: number,
    private readonly spentAtStart: number,
  ) {}

  add(inputTokens: number, outputTokens: number): void {
    this.spentThisWake += inputTokens + outputTokens;
  }

  get tokensThisWake(): number {
    return this.spentThisWake;
  }

  get spentToday(): number {
    return this.spentAtStart + this.spentThisWake;
  }

  get exhausted(): boolean {
    return this.spentToday >= this.dailyTokenLimit;
  }
}
