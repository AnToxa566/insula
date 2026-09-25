# Design (Claude Design)

Insula's UI designs live in Claude Design, not in this repo. Whenever a task
says to implement, update, or check something **"from the designs"**, do this before writing any UI code:

1. Find the matching row below (by keyword or by filename).
2. Fetch that file with the `claude_design` MCP server
   (`https://api.anthropic.com/v1/design/mcp`). If it isn't connected in this
   session yet, authenticate first with `/design-login`.
3. Also fetch everything listed under **Imports** for that file — those are
   read alongside it, not optionally.
4. Implement against the design system's tokens and components rather than
   inventing new ones. If the task doesn't already point at
   `Insula Design System.dc.html`, fetch it too before styling anything.
5. If it's ambiguous *which* file, or *which page* inside a multi-page file,
   ask — don't guess which page "лендинг" means if more than one could match.

## Project: Insula

<https://claude.ai/design/p/cb32825c-c622-47a6-8824-2269c363a73a>

| Trigger words (RU / EN) | File | Imports | What it covers |
|---|---|---|---|
| дизайн-кит, дизайн система, design system, токены, компоненты, цвета, типографика | `Insula Design System.dc.html` | — | Tokens, components, colors, typography. The source of truth for how any new UI should look — check it before implementing a page, not just when asked for "the design system" itself. |
| лендинг, landing, адаптив, adaptive, все страницы, all pages, страницы приложения | `Insula Adaptive.dc.html` | `support.js` | Every page with its responsive/adaptive layout, landing page included. If the task just says "лендинг" or "landing page", this is the file — but ask which section/page if more than one could be meant. |

## How to add a new file

1. Open the file in Claude Design and copy the exact value after `?file=` in
   its URL — that's what goes in the **File** column.
2. Claude Design shows what a file imports when you open it — list those
   under **Imports**; they get fetched alongside the file automatically by
   whoever follows this doc.
3. Add a row with the words a person would naturally use to ask for it, in
   both Russian and English if relevant — this is what makes "имплементируй
   X с дизайна" resolve without re-pasting a URL.
4. If the file belongs to a **different** Claude Design project (a different
   UUID in `/design/p/<uuid>`), don't add it to this table — start a new
   `## Project: <name>` section with its own URL and its own table.
