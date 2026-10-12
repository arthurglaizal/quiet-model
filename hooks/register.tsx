import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Default, Effort } from '../types'

const COMMAND = 'quiet-model'
// The design shared with Quiet Token Bar: neutral greys, color only as a signal.
const TEXT = '#8b8b90' // text and options at rest
const ON = '#d6d6da' // the selected option's name, brighter, a step short of white
const ON_FONT = 12 // the selected option's name, a pixel larger
const CHIP = '#323439' // the selected option's fill, a step above the ground
const TIP = '#b9b9be' // a tooltip's text, on the app's dark card
const NOTE =
  "The model picked here overrides the one shown in the app's menu: it is sent with each message, and named under each reply. Changing the app's menu afterwards switches back to it."
const INFO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8b8b90" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
const FONTS = "-apple-system, 'SF Pro Text', system-ui, sans-serif"
const FONT = 11
const TITLE_FONT = 13
const ROW = 32 // the line's height: a 20 px line and 12 px of air, so stacked mods do not touch
const MID = ROW / 2
const CHIP_HEIGHT = 20 // the line's height
const APP_FONT = 13 // the app's text size: an em space is this wide
const PX_PER_COLUMN = 8.4
const CHAR_WIDTH = 6.1 // a character's width at FONT, an estimate
// The title column as Quiet Token Bar draws its own (its picture is shrunk to fit, about 11/13), so both
// rows start their content at the same place and their titles read the same size.
const TITLE_WIDTH = Math.round(('Context'.length * CHAR_WIDTH * (TITLE_FONT / FONT) + 14) * (FONT / TITLE_FONT))
// A bookmark: the default for new sessions; filled when the row shows it.
const bookmark = (isFilled: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${isFilled ? '#8b8b90' : 'none'}" stroke="#8b8b90" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v16l-6-4l-6 4z"/></svg>`
const DEFAULT_TIP = 'Set as default model'
const DEFAULT_ON_TIP = 'Default model. Click to remove'
const CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8b8b90" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
const BUTTON_PADDING = 16 // what a desktop button adds around its label, an estimate
const BAND_CONTROL = 4 // the terminal's own `[-]` at the end of the band's first row, and a space before it

// The models offered, in the order of the row.
export const MODELS = [
  { name: 'Haiku', id: 'claude-haiku-4-5-20251001', hasEffort: false },
  { name: 'Sonnet', id: 'claude-sonnet-5-5', hasEffort: true },
  { name: 'Opus', id: 'claude-opus-5-5', hasEffort: true },
  { name: 'Fable', id: 'claude-fable-5-1', hasEffort: true },
] as const

export const EFFORTS: readonly { name: string; level: Effort }[] = [
  { name: 'Low', level: 'low' },
  { name: 'Medium', level: 'medium' },
  { name: 'High', level: 'high' },
  { name: 'X High', level: 'xhigh' },
  { name: 'Max', level: 'max' },
]

// Session values: a new session starts on its own model again, a hot reload keeps the choice.
const chosenModel = atom({ plugin: 'quiet-model', key: 'model' } as const, null)
const chosenEffort = atom({ plugin: 'quiet-model', key: 'effort' } as const, null)
const used = atom({ plugin: 'quiet-model', key: 'used' } as const, null)
const isHidden = atom({ plugin: 'quiet-model', key: 'isHidden' } as const, false)
// The app's own menu (under the prompt) as the last request found it; null right after a pick here, as unknown.
// When that menu moves, the person touched it last: it wins over this row's choice.
const appModel = atom({ plugin: 'quiet-model', key: 'appModel' } as const, null)
const appEffort = atom({ plugin: 'quiet-model', key: 'appEffort' } as const, null)
// The end of each recent reply and what wrote it, so the reply drawn is signed underneath. Kept in the
// session's memory only, as short tails: the text of a reply is not stored.
const replies = atom({ plugin: 'quiet-model', key: 'replies' } as const, [])
const KEPT_REPLIES = 100
const TAIL = 160
// Whether a block drawn is the end of the reply whose tail is kept.
const isEndOf = (tail: string, shown: string) => (shown.length >= TAIL ? shown.slice(-TAIL) === tail : tail.endsWith(shown))
const isDefaultApplied = atom({ plugin: 'quiet-model', key: 'isDefaultApplied' } as const, false)
// The default kept across sessions ($.store), mirrored here so the bookmark redraws when it changes.
const savedDefault = atom({ plugin: 'quiet-model', key: 'savedDefault' } as const, null)

// The offered model an id or a display name stands for ('claude-opus-5-5', 'Opus 5.5', 'opus').
export function modelOf(text: string | undefined) {
  const t = (text ?? '').toLowerCase()
  return MODELS.find(m => t.includes(m.name.toLowerCase()))
}

// What a request runs on, as the row names it: 'Sonnet · High', 'Haiku'.
export function usedLabel(model: string, effort: Effort | number | undefined) {
  const name = modelOf(model)?.name ?? model
  if (effort === undefined) return name
  return `${name} · ${EFFORTS.find(x => x.level === effort)?.name ?? effort}`
}

// The request as it goes out: the chosen model and effort in place of the session's. A model without
// an effort setting (Haiku) is sent none.
export function rewrite<S extends { model: string; effort?: Effort | number }>(
  step: S,
  model: string | null,
  effort: Effort | null,
): S {
  if (model === null && effort === null) return step
  const { effort: current, ...rest } = step
  const id = model ?? step.model
  const hasEffort = modelOf(id)?.hasEffort ?? current !== undefined
  const level = effort ?? current
  return (hasEffort && level !== undefined ? { ...rest, model: id, effort: level } : { ...rest, model: id }) as S
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'Show or hide the model and effort picker above the prompt' })
    if ((await $.store.get('isHidden').catch(() => undefined)) === true) await update($, isHidden, () => true) // the cross is remembered
    // A new session starts on the saved default; a hot reload keeps what was picked since.
    const saved = ((await $.store.get('default').catch(() => undefined)) ?? null) as Default | null
    await update($, savedDefault, () => saved)
    if (saved && !(await read($, isDefaultApplied))) {
      await update($, chosenModel, () => saved.model)
      await update($, chosenEffort, () => saved.effort)
    }
    await update($, isDefaultApplied, () => true)
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    const hidden = await update($, isHidden, was => !was)
    await $.store.set('isHidden', hidden).catch(() => {})
    return { text: hidden ? `Model picker hidden. /${COMMAND} shows it again` : 'Model picker on' }
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e) // a subagent keeps its own model
    const effortNow = String(e.effort ?? 'none')
    const [seenModel, seenEffort] = [await read($, appModel), await read($, appEffort)]
    if (seenModel !== null && seenModel !== e.model) await update($, chosenModel, () => null)
    if (seenEffort !== null && seenEffort !== effortNow) await update($, chosenEffort, () => null)
    await update($, appModel, () => e.model)
    await update($, appEffort, () => effortNow)
    const step = rewrite(e, await read($, chosenModel), await read($, chosenEffort))
    const effort = step.effort ?? null
    await update($, used, u => (u?.model === step.model && u.effort === effort ? u : { model: step.model, effort }))
    const result = yield* next(step)
    const text = result.answer.trim()
    if (text && result.stopReason !== 'tool_use') {
      const reply = { tail: text.slice(-TAIL), label: usedLabel(step.model, step.effort) }
      await update($, replies, r => [...r, reply].slice(-KEPT_REPLIES))
    }
    return result
  })

  // Under the reply's last block, small and dim: 'Opus · High'.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const drawn = await next(e)
    const text = e.props.text.trim()
    const reply = text ? [...(await read($, replies))].reverse().find(r => isEndOf(r.tail, text)) : undefined
    if (!reply) return drawn
    const { Box, Text } = $.ui.resolve(e)
    const line = reply.label
    const Svg = (e.surface === 'terminal' ? undefined : ($.ui.resolve(e) as any).Svg) as
      | ((props: { source: string; alt: string; width?: number; height?: number }) => any)
      | undefined
    // Given its size in pixels, or the app stretches the picture across the reply's width.
    const sig = signatureSize(line)
    return (
      <Box flexDirection="column">
        {drawn}
        {Svg ? (
          <Box width={Math.ceil(sig.width / PX_PER_COLUMN)}>
            <Svg source={signatureSvg(line)} alt={line} width={sig.width} height={sig.height} />
          </Box>
        ) : (
          <Text dimColor>{line}</Text>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rest = await next(e) // what other mods (the context bar) and Claude Code draw here stays
    if (e.props.hasSurvey || (await read($, isHidden))) return rest
    const { Box, Text, Button } = $.ui.resolve(e)

    const last = await read($, used)
    // Checked: the choice, else what the app's menu sent last, else the session's model. The app's menu
    // itself cannot be read: its choice is known once a message has gone out.
    const model = modelOf(
      (await read($, chosenModel)) ?? (await read($, appModel)) ?? last?.model ?? (await $.session.model()),
    )
    const sentEffort = await read($, appEffort)
    const appLevel = EFFORTS.find(x => x.level === sentEffort)?.level
    const effort =
      (await read($, chosenEffort)) ?? appLevel ?? (typeof last?.effort === 'string' ? last.effort : null)

    // Two toggle groups on one line, each option in a box of fixed width so a click never moves the row. On the
    // desktop an option is a picture of its name at the context bar's 11 px, the selected one brighter on a
    // chip, under an empty button that spans the box (em spaces, one per 13 px of the app's text).
    const Svg = (e.surface === 'terminal' ? undefined : ($.ui.resolve(e) as any).Svg) as
      | ((props: { source: string; alt: string; width?: number; height?: number }) => any)
      | undefined
    const toggle = (key: string, name: string, isOn: boolean, onPress: () => unknown) => {
      if (!Svg) {
        return (
          <Box backgroundColor={isOn ? CHIP : undefined}>
            <Button key={key} plain dimColor={!isOn} label={` ${name} `} onPress={() => void onPress()} />
          </Box>
        )
      }
      const cols = optionColumns(name)
      return (
        <Box width={cols} height={1} justifyContent="center" alignItems="center">
          <Svg source={optionSvg(name, isOn, cols * PX_PER_COLUMN)} alt={isOn ? `${name}, selected` : name} />
          <Box position="absolute" top={0} left={0} width={cols} height={1} justifyContent="center" alignItems="center">
            <Button key={key} plain label={cover(cols)} onPress={() => void onPress()} />
          </Box>
        </Box>
      )
    }
    // A stroked icon in its own two-cell box with an empty button over it, as the context bar's buttons.
    const iconButton = (b: { key: string; icon: string; alt: string; press: () => unknown }) =>
      Svg && (
        <Box width={2} height={1} justifyContent="center" alignItems="center">
          <Svg source={b.icon} alt={b.alt} width={12} height={12} />
          <Box position="absolute" top={0} left={0} width={2} height={1}>
            <Button key={b.key} plain label={'\u00A0\u00A0'} onPress={() => void b.press()} />
          </Box>
        </Box>
      )
    // The bookmark saves what the row shows as the default for new sessions; pressed on the default, it clears it.
    const saved = await read($, savedDefault)
    const shown: Default | null = model ? { model: model.id, effort: model.hasEffort ? effort : null } : null
    const isDefault = !!shown && saved?.model === shown.model && saved.effort === shown.effort
    const toggleDefault = async () => {
      if (!shown) return
      await (isDefault ? $.store.delete('default') : $.store.set('default', shown)).catch(() => {})
      await update($, savedDefault, () => (isDefault ? null : shown))
      $.ui.toast(isDefault ? 'Default model removed' : `Default model: ${usedLabel(shown.model, shown.effort ?? undefined)}`)
    }

    const close = async () => {
      await update($, isHidden, () => true)
      await $.store.set('isHidden', true).catch(() => {})
    }

    return (
      <Box flexDirection="column">
        <Box alignItems="center" paddingX={1}>
          {Svg ? <Svg source={titleSvg()} alt="Model" /> : <Text dimColor>Model </Text>}
          <Box>
            {MODELS.map(m => toggle(m.id, m.name, m === model, () => pickModel($, m)))}
          </Box>
          {model?.hasEffort !== false && <Box width={2} />}
          {model?.hasEffort !== false && (
            <Box>
              {EFFORTS.map(x =>
                toggle(x.level, x.name, x.level === effort, () => pickEffort($, x.level)),
              )}
            </Box>
          )}
          <Box flexGrow={1} />
          {Svg ? (
            <Box columnGap={1}>
              <Box key="default-box" width={2} height={1}>
                {iconButton({ key: 'default', icon: bookmark(isDefault), alt: DEFAULT_TIP, press: toggleDefault })}
                <Box position="absolute" top={1} right={0} width={DEFAULT_ON_TIP.length + 2} display="none" hover={{ display: 'flex' }}>
                  <Text color={TIP}>{isDefault ? DEFAULT_ON_TIP : DEFAULT_TIP}</Text>
                </Box>
              </Box>
              {/* The note on hover: text only, under the icon, right-aligned so it stays in the card. */}
              <Box key="info-box" width={2} height={1}>
                {iconButton({ key: 'info', icon: INFO, alt: 'About', press: () => undefined })}
                <Box position="absolute" top={1} right={0} width={NOTE.length + 2} display="none" hover={{ display: 'flex' }}>
                  <Text color={TIP}>{NOTE}</Text>
                </Box>
              </Box>
              {iconButton({ key: 'close', icon: CLOSE, alt: 'Close', press: close })}
            </Box>
          ) : (
            <Box marginRight={BAND_CONTROL} columnGap={1}>
              <Button key="default" plain dimColor={!isDefault} label={isDefault ? '★' : '☆'} onPress={() => void toggleDefault()} />
              <Button key="close" plain dimColor label="×" onPress={() => void close()} />
            </Box>
          )}
        </Box>
        {rest}
      </Box>
    )
  })
}

// The columns an option takes on the desktop: its name and 8 px each side, rounded up to whole cells.
export const optionColumns = (name: string) => Math.ceil((name.length * CHAR_WIDTH + 16) / PX_PER_COLUMN)

const svgOpen = (width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONTS}" font-size="${FONT}">`

// An option's name at 11 px, centered in its box; the selected one brighter, on a chip.
export function optionSvg(name: string, isOn: boolean, width: number) {
  const w = Math.round(width)
  const chip = isOn ? `<rect x="0" y="0" width="${w}" height="${CHIP_HEIGHT}" rx="4" fill="${CHIP}"/>` : ''
  return `${svgOpen(w, CHIP_HEIGHT)}${chip}<text x="${w / 2}" y="${CHIP_HEIGHT / 2 + 4}" text-anchor="middle" fill="${isOn ? ON : TEXT}"${isOn ? ` font-size="${ON_FONT}"` : ''}>${name}</text></svg>`
}

// A reply's signature: small and in the text grey, so it reads as context.
const SIGNATURE_FONT = 12
const SIGNATURE_COLOR = '#6e6e73' // a step under the text grey, as the app's own context lines
const SIGNATURE_GAP = 10 // air above it, so it reads apart from the reply
export const signatureSize = (line: string) => ({
  width: Math.ceil(line.length * CHAR_WIDTH * (SIGNATURE_FONT / FONT)) + 4,
  height: SIGNATURE_GAP + 16,
})
export function signatureSvg(line: string) {
  const { width, height } = signatureSize(line)
  const safe = line.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `${svgOpen(width, height)}<text x="0" y="${SIGNATURE_GAP + 12}" font-size="${SIGNATURE_FONT}" fill="${SIGNATURE_COLOR}">${safe}</text></svg>`
}

// The empty label that makes a button span `cols` cells: em spaces are as wide as the app's text size.
// Rounded down, with room for the button's own padding: a label wider than its box is cut with an ellipsis,
// drawn as dots under the name.
export const cover = (cols: number) =>
  '\u2003'.repeat(Math.max(1, Math.floor((cols * PX_PER_COLUMN - BUTTON_PADDING) / APP_FONT)))

// The row's title, as wide as the context bar's so the two rows start their content at the same place.
export const titleSvg = () =>
  `${svgOpen(TITLE_WIDTH, ROW)}<text x="0" y="${MID + 4}" fill="${TEXT}">Model</text></svg>`

async function pickModel($: EngineInterface, m: (typeof MODELS)[number]) {
  // Kept here and applied to each request (turn.step), never written to the settings: the desktop app sends
  // its own menu's model with each message whatever the settings say.
  await update($, chosenModel, () => m.id)
  await update($, appModel, () => null)
  await update($, used, () => null)
}

async function pickEffort($: EngineInterface, level: Effort) {
  await update($, chosenEffort, () => level)
  await update($, appEffort, () => null)
}
