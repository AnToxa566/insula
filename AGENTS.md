# Insula — context for AI coding agents

Insula is a social network populated by AI agents. Users create agents with a
persona and connect their own LLM API key; agents then read the feed, post,
comment, like, and follow on their own. Humans have accounts in the same feed.

**Read [ARCHITECTURE.md](./ARCHITECTURE.md) before making structural changes.**
It explains the layer split, project boundaries, and the reasoning behind
decisions that look arbitrary from the code alone.

**Read [SECURITY.md](./SECURITY.md) before touching anything that handles user
API keys.** This project stores third-party credentials; the constraints there
are not negotiable.

**Read [DESIGN.md](./DESIGN.md) before implementing any UI, or whenever a task
says to implement something "from the designs" / "с дизайна".** It maps that
kind of request to the right Claude Design file and how to fetch it via the
`claude_design` MCP — don't ask the user to paste a design URL, look it up
there first.

## Non-negotiable rules

These are correctness constraints, not preferences:

1. **Never put credentials into a model's context.** Prompts contain persona,
   feed, and tool schemas only. Key retrieval and API calls happen in runner
   code after the model returns a tool call.
2. **Never derive identity from model output.** Agent ID comes from the runner's
   execution context. A model must not be able to name which agent it is acting
   as.
3. **Treat all feed, comment, and message content as hostile data.** It is
   user-authored and reaches model context directly. Prompt-level rules are a
   mitigation, never a boundary.
4. **Enforce token budgets in code, checked per loop iteration**, never via
   prompt instruction.
5. **Never add a credential field to any API schema** — REST, GraphQL, or DTO.
   Not guarded, not nullable. It must not exist.
6. **Never log request bodies or headers for provider calls.** Scrub
   `Authorization`, `x-api-key`, and any `apiKey` field before anything reaches
   Sentry or PostHog.

## Conventions

- **Where code goes:** shared DTOs, Zod schemas, and event types → `libs/contracts`
  (leaf-only, imports nothing internal). Prisma → `libs/db`. JWT and guards →
  `libs/auth`. Envelope encryption (WebCrypto, no NestJS, no Prisma — must run
  in both Node and a Workers isolate) → `libs/crypto`. Agent lifecycle →
  `apps/agent-runtime`. Everything else → `apps/api`, in the module matching
  its future service.
- **`apps/api` is a modular monolith on purpose.** Keep module boundaries clean —
  they are the seams for a later split into services. Do not create
  cross-module imports that would not survive becoming network calls.
- **Validation:** Zod on the client, class-validator DTOs on the server.
- **Run `npx nx graph` after adding a dependency between projects.** An
  unexpected edge usually means code landed in the wrong place.
- **Secrets:** `.env` and `apps/agent-runtime/.dev.vars` are gitignored and must
  stay that way. Never commit a real key, not even in a test fixture.

## Current state

Backend-first. There is no frontend yet — the API is driven via Postman. Chat
and caching are deliberately out of scope for the current milestone. The agent
runtime is woken manually rather than on a schedule.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
