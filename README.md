<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-model/releases/download/v2.0.0/quiet-model.gif" alt="Quiet Model demo: the model and effort row above the Claude Code prompt, and Magic Router choosing the model for each message" width="100%">
</p>

# Quiet Model

> **Pick the model and effort in one quiet grey row, or let Magic Router pick for you.**

A Claude Code mod that sits above the prompt and lets you switch between Haiku, Sonnet, Opus and Fable, and set the effort, for the rest of the session. No menu to open, no command to type. An optional auto mode, **Magic Router**, picks them for you, message by message, and shows what it saved.

It stays neutral: everything is grey, and only the option you picked is brighter.

## What it shows

The same single row comes in two designs.

**Desktop app**: the design in the demo above, and the reference. Small grey text, the selected option on a soft chip, tooltips on hover.

**Terminal**: the same row drawn with the terminal's own text. The selected option sits on a filled chip (shown here between brackets):

```txt
Model  Haiku  Sonnet  [Opus]  Fable    Low  Medium  [High]  X High  Max        ✧  ☆  ◉  ⚙  ×
```

From left to right:

- **Model**: Haiku, Sonnet, Opus or Fable. Click one and your next messages go to it.
- **Effort**: Low, Medium, High, X High or Max, for every model.
- **Context warning** (a small red figure, on the right): shown only when your context does not fit the model's window (1M tokens), for example `> 1.0M`. Hover it for the details. The price of a switch is not shown.
- **Spinner**: a small ring turns in the same place while Magic Router analyzes your message. When it is done, a check takes its place; hover it to read the result and what the analysis cost. It goes away when you write again.
- **Default** (the bookmark): saves what the row shows as the model new sessions start on. Click it again to clear. It is filled while the row shows your default.
- **Eye**: shows or hides the model named under each reply. On the soft chip, brighter, while the model is shown; grey, without chip, while it is hidden. Your choice is kept across sessions.
- **Info**: hover for a reminder of how the row and the app's own model menu work together.
- **Route icon**: turns Magic Router on or off. Like a model option, it sits on the soft chip, brighter, while it is on. The tooltip says whether it is on, and for this project or for every project.
- **Gear**: opens or closes the settings pane: the default model and Magic Router. The app places it beside the conversation when the window is wide enough, above the prompt otherwise. The gear sits on its chip while the pane is open.
- **Close**: hides the row. Your choice is kept across sessions.

Under each reply, a small grey line names what wrote it, for example `Opus · High`, or `Sonnet · Medium (Magic Router)` when Magic Router picked it. It is the one place that always tells the truth about which model answered.

The settings pane starts with the **default model**: what new sessions start on, as the bookmark saved it, or none.

## Magic Router

Off by default. Turn it on with the route icon in the row, or with the switch in the settings pane (the gear). Then a small model reads what you are writing and the last messages, decides how much model the task needs, and the row follows: the chips move by themselves, and your next message goes out on them. Under each reply, the grey line says `(Magic Router)` when it chose.

<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-model/releases/download/v2.0.0/magic-router-routing.png" alt="Totals in the settings pane: a Sankey diagram of the messages Magic Router routed, from Magic Router to each model, then to each effort" width="100%">
</p>

The diagram is your **Totals**: where Magic Router sent your messages, by model and effort, with how many did not need Opus and an estimate of what that saved.

### Settings

Open them with the gear. All of them are per project, or for every project (**Applies to**).

| Setting | What it does | Default |
| --- | --- | --- |
| **Analyst** | The model that reads and decides. More effort makes it think longer: maybe a better choice, a longer wait. | Haiku · Medium |
| **Context** | How many of the last messages it reads, from 1 to 10. This is what lets it understand a short `go` or `ok`. | 5 |
| **Excerpt** | How many characters of each message it reads (200 to 3000): a third from the start, the rest from the end, where a question usually sits. | 600 |
| **Delay** | How long it waits after you stop typing before it starts, from 0.1 to 5 seconds. | 0.4 s |
| **Guard** | Keeps the current model when a switch down would cost more than this amount in cache (from $0.1 to $5, or Off). | $1.00 |
| **Allowed picks** | The models and efforts it may choose. It is shown these and nothing else, so fewer picks make its choice easier and steadier. | 5 picks, Fable off |
| **Applies to** | **This project** (default) or **Everywhere** (every project without settings of its own). A change made in another conversation counts from your next message. | This project |

**Why a guard.** A prompt cache belongs to one model. Switching to a smaller one rewrites your whole conversation in its cache, which can cost more than it saves. Under the setting, the pane shows what a switch down would cost now. When it is above your amount, Magic Router stays on the current model and Result says so (`kept: switching down to Sonnet · Medium would cost ≈ $0.86`). It never holds back a switch up, nor after an hour without a request, when no cache is left anyway.

**Why allowed picks.** The analyst gets a short table of the options you allow, each with its price and what it is for, so any option you tick can be chosen. By default: Haiku · High, Sonnet · Low, Sonnet · Medium, Opus · High and Opus · Max. Fable, the dearest, is off. If it names an option you did not allow, the next allowed one up is used. The descriptions follow Anthropic's model and effort guidance as of 14 October 2026 and need redoing when new models come out.

### What you see

- **Result**, at the top of the pane: the pick and why, what the analysis cost and how long it took (`analysis $0.0001 · 1.2 s`). The refresh button analyzes again.
- **The ring and the check**, in the row: a ring turns while it analyzes. A check takes its place when done; hover it for the result.
- **Totals**: messages routed to each model, `17 of 23 off Opus`, what the analyses cost, and `≈ $3.13 saved vs Opus · High`. Three chips choose whose figures you read: **Everywhere** (all your conversations, the default), **This project**, or **This session**. The first two count from the day you installed this version, and are kept on your machine as numbers only. The saving is an estimate, not a bill; its tooltip lists the assumptions.

Your own click in the row wins for the message you are writing. Magic Router takes over again with the next one. If you send before the analysis is done, the message waits for it two seconds at most, then goes out on the model it had.

## Which one wins

The app has its own model menu under the prompt, and a mod cannot move it. So the rule is simple: **the last selector you touched wins.**

- Pick an option in the row: it is sent with every message from then on, whatever the app's menu says.
- Change the app's menu afterwards: it takes over again at your next message, and the row follows it.
- Pick in the row again: the row takes the lead back.

## How to use

Once installed, the row appears above the prompt in every new session.

| Action | How |
| --- | --- |
| Show or hide the row | `/quiet-model` |
| Change the model or the effort | click an option |
| Make the current choice your default | the bookmark |
| Hide or show the model under replies | the eye |
| Open the settings (default model, Magic Router) | the gear |
| Turn Magic Router on or off | the route icon, or the switch in the settings pane |
| Analyze the draft again | the refresh button in the settings pane |
| See what answered | the grey line under the reply |
| Read how the row and the app's menu relate | hover the info icon |

## Limitations

- Mods are a recent Claude Code feature: you need a version with mod support (tested on **Claude Code 2.1.296**), and an update can change the mod API.
- The app's model menu is not touched, so it may show another model than the one actually used. The line under each reply is the reference.
- If you change the effort in the app, the row shows it after your next message. The model is updated right away.
- The list is fixed: Haiku 5.5, Sonnet 5.5, Opus 5.5 and Fable 5.1. If your plan or your Claude Code version does not offer one, picking it makes the request fail; pick another. Haiku 5.5's input price is $0.10 per million tokens up to 100k tokens of prompt, and five times that above: the estimates follow it.
- Only the main conversation is switched. Subagents keep their own model.
- The prices Magic Router shows (the analysis, the guard, the Totals estimate) are calculations at Anthropic's list prices for input, with output taken as 5 times that price and a cache read at each model's own rate (a tenth of the input price, half of that for Opus, a quarter for Fable), not bills. On a subscription nothing is billed per token: read them as a relative weight.
- Magic Router's advice is a judgment by a small model, and it can be wrong. It is shown before you send, in the row and in the settings pane, and your click always wins. Guard weighs the prompt cache for a switch down; nothing else does.
- On desktop, widths are estimated from terminal columns, so spacing can shift slightly with the window size.
- Hiding the row does not undo your choice: it keeps applying until you pick again or start a new session.

## What it runs and keeps

- **No network requests of its own.** Nothing is sent anywhere by the mod. The one exception is Magic Router, which is off until you turn it on: once on, after each pause in your typing, your draft and your last messages go to the analyst model (Haiku by default) through your own Claude session, the same way your messages do, before you press Enter. It counts in your plan's usage like any request. Turn it off and nothing is read.
- **No commands.** It never runs a slash command or changes your Claude Code settings. It only replaces the model and the effort of the requests you send from the main conversation.
- **What it hooks:**
  - `command.run`, only for `/quiet-model`: shows or hides the row. It never sees any other command.
  - `turn.step`: for each request from the main conversation, puts in the model and effort you picked. It also reads the request's model and effort, to notice when you changed the app's menu, and, with Magic Router on, waits a moment for the analysis of the message that goes out. Subagents are left alone.
  - `prompt.edit`: only with Magic Router on, reads the draft as you type (it never changes it) to start the analysis after your pause.
  - `prompt.submit`: only with Magic Router on, notes that the message goes out, so its analysis can finish first. It never changes the message.
  - `ui.render`: draws the row above the prompt, the settings pane, and the small line under each reply.
  - `ui.close`: notes that you closed the settings pane, so the gear leaves its chip.
  - `session.start`: registers `/quiet-model` and loads your saved settings.
- **In the session's memory only**: your current choice, how many tokens the last request held (to estimate a switch), what the last analysis found, what Magic Router did this session (messages by model, costs), and the last 160 characters of recent replies, used to tell which reply to sign. Nothing about a reply or a draft is written to disk.
- **Five values kept on your machine**, in Claude Code's plugin storage: whether you closed the row, your default model and effort, whether the model is shown under replies, Magic Router's settings (on or off, the analyst, how many messages it reads, how many characters of each, the delay, the guard, the allowed picks), for each project you set it in, or for every project, and its Totals, per project and for every project: counts of messages by model and effort, and costs, never a word of a message. Projects are told apart by their folder.

## Install in Claude Code

This repository is its own plugin marketplace.

```sh
claude plugin marketplace add arthurglaizal/quiet-model
claude plugin install quiet-model@quiet-model
```

Or, in a Claude Code session:

```txt
/plugin marketplace add arthurglaizal/quiet-model
/plugin install quiet-model@quiet-model
```

Start a new session and the row appears above the prompt.

To try it without installing, clone the repository and run:

```sh
claude --plugin-dir ./quiet-model
```

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
| [Quiet Token Bar](https://github.com/arthurglaizal/quiet-token-bar) | Your context window in one quiet line: a patterned bar, a compact button and your session and weekly limits, grey until something gets warm. |
| [Quiet Cost](https://github.com/arthurglaizal/quiet-cost) | What each reply cost, in one quiet grey line under it: an estimated price, the time and the tokens, and more figures you pick. |

## Support

If you find my work useful, you can [buy me a coffee](https://ko-fi.com/arturo_ux) ☕️

## License

MIT — see [LICENSE](LICENSE).
