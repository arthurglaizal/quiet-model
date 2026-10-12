<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-model/releases/download/v1.0.0/quiet-model.gif" alt="Quiet Model demo: the model and effort row above the Claude Code prompt" width="100%">
</p>

# Quiet Model

> **Pick the model and the effort in one quiet grey row.**

A Claude Code mod that sits above the prompt and lets you switch between Haiku, Sonnet, Opus and Fable, and set the effort, for the rest of the session. No menu to open, no command to type.

It stays neutral: everything is grey, and only the option you picked is brighter.

## What it shows

The same single row comes in two designs.

**Desktop app**: the design in the demo above, and the reference. Small grey text, the selected option on a soft chip, tooltips on hover.

**Terminal**: the same row drawn with the terminal's own text. The selected option sits on a filled chip (shown here between brackets):

```txt
Model  Haiku  Sonnet  [Opus]  Fable    Low  Medium  [High]  X High  Max        ☆  ×
```

From left to right:

- **Model**: Haiku, Sonnet, Opus or Fable. Click one and your next messages go to it.
- **Effort**: Low, Medium, High, X High or Max. Haiku has no effort setting, so the effort options disappear while it is selected.
- **Default** (the bookmark): saves what the row shows as the model new sessions start on. Click it again to clear. It is filled while the row shows your default.
- **Info**: hover for a reminder of how the row and the app's own model menu work together.
- **Close**: hides the row. Your choice is kept across sessions.

Under each reply, a small grey line names what wrote it, for example `Opus · High`. It is the one place that always tells the truth about which model answered.

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
| See what answered | the grey line under the reply |
| Read how the row and the app's menu relate | hover the info icon |

## Limitations

- Mods are a recent Claude Code feature: you need a version with mod support (tested on **Claude Code 2.1.289**), and an update can change the mod API.
- The app's model menu is not touched, so it may show another model than the one actually used. The line under each reply is the reference.
- If you change the effort in the app, the row shows it after your next message. The model is updated right away.
- The list is fixed: Haiku 4.5, Sonnet 5.5, Opus 5.5 and Fable 5.1. If your plan does not include one, picking it makes the request fail; pick another.
- Only the main conversation is switched. Subagents keep their own model.
- On desktop, widths are estimated from terminal columns, so spacing can shift slightly with the window size.
- Hiding the row does not undo your choice: it keeps applying until you pick again or start a new session.

## What it runs and keeps

- **No network requests.** Nothing is sent anywhere by the mod.
- **No commands.** It never runs a slash command or changes your Claude Code settings. It only replaces the model and the effort of the requests you send from the main conversation.
- **What it hooks:**
  - `command.run`, only for `/quiet-model`: shows or hides the row. It never sees any other command.
  - `turn.step`: for each request from the main conversation, puts in the model and effort you picked. It also reads the request's model and effort, to notice when you changed the app's menu. Subagents are left alone.
  - `ui.render`: draws the row above the prompt, and the small line under each reply.
  - `session.start`: registers `/quiet-model` and loads your saved default.
- **In the session's memory only**: your current choice, and the last 160 characters of recent replies, used to tell which reply to sign. Nothing about a reply is written to disk.
- **Two values kept on your machine**, in Claude Code's plugin storage: whether you closed the row, and your default model and effort.

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
│   ├── marketplace.json
│   └── icon.png
├── hooks/
│   ├── hooks.json
│   └── register.tsx
├── types/index.d.ts
└── tests/quiet-model.test.tsx
```

Run the checks with `claude plugin validate .` and `claude plugin test .`.

## Quiet mods

<p align="center">
  <img src="https://github.com/arthurglaizal/quiet-model/releases/download/v1.0.0/quiet-mods.png" alt="Quiet Token Bar and Quiet Model stacked above the Claude Code prompt" width="100%">
</p>

The Quiet mods share one design: grey by default, color only when something needs you. They stack neatly above the prompt.

| Mod | Description |
| --- | --- |
| [Quiet Token Bar](https://github.com/arthurglaizal/quiet-token-bar) | Your context window in one quiet line: a patterned bar, a compact button and your session and weekly limits, grey until something gets warm. |

## Support

If you find my work useful, you can [buy me a coffee](https://ko-fi.com/arturo_ux) ☕️

## License

MIT — see [LICENSE](LICENSE).
