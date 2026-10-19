<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-model/releases/download/v2.0.0/quiet-model.gif" alt="Quiet Model demo: the model and effort row above the Claude Code prompt, and Magic Router choosing the model for each message" width="100%">
</p>

# Quiet Model

> **Pick the model and effort in one quiet grey row, or let Magic Router pick for you.**

A Claude Code mod that sits above the prompt. Switch between Haiku, Sonnet, Opus and Fable, and set the effort, in one click: no menu, no command. Or turn on **Magic Router**: it picks them for each message and shows what it saved.

Everything is grey. Only the option you picked is brighter.

## The row

On desktop, small grey text with your choice on a soft chip. In the terminal, the same row in plain text:

```txt
Model  Haiku  Sonnet  [Opus]  Fable    Low  Medium  [High]  X High  Max        ✧  ☆  ◉  ⚙  ×
```

- **Model** and **effort**: click one, and your next messages use it.
- **Context warning**: a small red figure, only when your context does not fit the model, for example `> 1.0M`.
- **Ring, then check**: Magic Router is analyzing, then done. Hover the check for the result.
- **Bookmark**: makes the current choice the default for new sessions.
- **Eye**: shows or hides the model under each reply.
- **Info**: how the row and the app's model menu work together.
- **Route icon**: turns Magic Router on or off.
- **Gear**: opens the settings pane.
- **Close**: hides the row. `/quiet-model` brings it back.

Under each reply, a grey line says what wrote it: `Opus · High`, or `Sonnet · Medium (Magic Router)`. It is the one place that always tells which model answered.

## Install

```sh
claude plugin marketplace add arthurglaizal/quiet-model
claude plugin install quiet-model@quiet-model
```

Start a new session and the row appears. To update later: `claude plugin update quiet-model@quiet-model`. To try it without installing, clone the repository and run `claude --plugin-dir ./quiet-model`.

## Magic Router

Off by default. Once on, a small model reads your draft and the last messages, decides how much model the task needs, and the row follows. Your own click still wins for the message you are writing.

<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-model/releases/download/v2.0.0/magic-router-routing.png" alt="Totals in the settings pane: a Sankey diagram of the messages Magic Router routed, from Magic Router to each model, then to each effort" width="100%">
</p>

This is the **Totals** view: where your messages went, by model and effort, and an estimate of what that saved compared with Opus · High.

### Settings

In the settings pane (the gear).

| Setting | What it does | Default |
| --- | --- | --- |
| **Analyst** | The model that decides. More effort: maybe a better choice, a longer wait. | Haiku · Medium |
| **Context** | How many recent messages it reads (1 to 10), so it understands a short `go`. | 5 |
| **Excerpt** | How many characters of each message it reads (200 to 3000). | 600 |
| **Delay** | How long it waits after you stop typing (0.1 to 5 s). | 0.4 s |
| **Guard** | Keeps the current model when a switch down would cost more than this in cache. | $1.00 |
| **Allowed picks** | The models and efforts it may choose. | 5 picks, Fable off |
| **Applies to** | This project, or every project. | This project |

**Why a guard.** A prompt cache belongs to one model. Switching to a smaller one rewrites the whole conversation in its cache, which can cost more than it saves. The pane shows what a switch down would cost right now.

**Why allowed picks.** The analyst only sees the options you tick, each with its price and what it is for, following Anthropic's guidance as of 14 October 2026. Fewer picks make its choice steadier.

### What you see

- **Result**, in the pane: the pick, why, what the analysis cost and how long it took.
- **Totals**: messages per model, the analysis costs and the estimated saving, for **Everywhere** (the default), **This project** or **This session**. The saving is an estimate, not a bill.

## Which one wins

A mod cannot move the app's own model menu, so **the last selector you touched wins**. Pick in the row: it applies from then on. Change the app's menu: it takes over at your next message, and the row follows.

## Limitations

- Needs a Claude Code version with mods (tested on 2.1.296). An update can change the mod API.
- The app's menu may show another model than the one used. The line under each reply is the reference.
- If your plan does not offer a model (Haiku 5.5, Sonnet 5.5, Opus 5.5, Fable 5.1), its requests fail: pick another.
- Subagents keep their own model.
- Prices are estimates at list price, not bills. Magic Router can be wrong: your click always wins.

## What it runs and keeps

- **No network requests of its own.** Only Magic Router, once on, sends your draft and last messages to the analyst model through your own Claude session. It counts in your plan's usage like any request.
- **No commands, no settings changed.** It only sets the model and effort of the main conversation's requests.
- **Hooks**: `command.run` (only `/quiet-model`), `turn.step` (sets the model and effort, never for subagents), `prompt.edit` and `prompt.submit` (only with Magic Router on, they never change your message), `ui.render` and `ui.close` (draw the row and the pane), `session.start` (registers `/quiet-model`).
- **Kept on your machine**: your choices, Magic Router's settings and its Totals (counts and costs, never a word of a message).

## Repository structure

```txt
quiet-model/
├── README.md
├── LICENSE
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── hooks/
│   ├── hooks.json
│   └── register.tsx
├── types/index.d.ts
└── tests/quiet-model.test.tsx
```

Run the checks with `claude plugin validate .` and `claude plugin test .`.

## Quiet mods

<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-model/releases/download/v2.0.0/quiet-mods.png" alt="Quiet Token Bar and Quiet Model stacked above the Claude Code prompt" width="100%">
</p>

The Quiet mods share one design: grey by default, color only when something needs you. They stack neatly above the prompt.

| Mod | Description |
| --- | --- |
| [Quiet&nbsp;Token&nbsp;Bar](https://github.com/arthurglaizal/quiet-token-bar) | Your context window in one quiet line: a patterned bar, a compact button and your session and weekly limits, grey until something gets warm. |
| [Quiet&nbsp;Cost](https://github.com/arthurglaizal/quiet-cost) | What each reply cost, in one quiet grey line under it: an estimated price, the time and the tokens, and more figures you pick. |
| [Quiet&nbsp;Server](https://github.com/arthurglaizal/quiet-server) | Launch your servers without leaving the conversation and catch the ones still running elsewhere: a count in the status line, the details in a pane. |

## Support

If you find my work useful, you can [buy me a coffee](https://ko-fi.com/arturo_ux) ☕️

## License

MIT — see [LICENSE](LICENSE).
