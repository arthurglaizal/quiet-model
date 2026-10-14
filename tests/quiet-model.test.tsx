import { describe, expect, mock, test } from 'claude-code/testing'

import {
  MODELS,
  analysisPrompt,
  analysisTokens,
  analysisUsd,
  cleanMagic,
  resolveMagic,
  DEFAULT_MAGIC,
  DEFAULT_ALLOWED,
  cleanAllowed,
  clipSegments,
  clampDelay,
  clampDepth,
  clampExcerpt,
  clampGuard,
  guardPick,
  tallyStep,
  tallyReply,
  tallyAnalysis,
  netUsd,
  offOpus,
  formatNet,
  countsText,
  NO_TALLY,
  routeTree,
  fullTally,
  treeLines,
  sankeySvg,
  costSvg,
  cover,
  planEdit,
  wrapSegments,
  formatAnalysisUsd,
  formatTokens,
  formatUsd,
  routerSvg,
  routerTip,
  modelOf,
  optionTip,
  parseVerdict,
  pickFor,
  pickRoute,
  spinnerSvg,
  checkSvg,
  ROUTES,
  analystSystem,
  ROUTE_NOTES,
  recacheUsd,
  segmentsSvg,
  signatureSvg,
  switchCost,
  switchSvg,
  usedLabel,
  optionColumns,
  optionSvg,
  rewrite,
  titleSvg,
} from '../hooks/register'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } }
const HAIKU = 'claude-haiku-5-5'
const SONNET = 'claude-sonnet-5-5'
const OPUS = 'claude-opus-5-5'
const STEP = { turnId: 't', index: 0, model: 'claude-sonnet-5-5', effort: 'medium', messageCount: 3 }

// Stands for the engine beneath the mod: it keeps the requests it was sent.
function engine(on: any, reply = (_e: any) => ({ answer: '', stopReason: 'end_turn' })) {
  const sent: any[] = []
  const toasts: string[] = []
  const logs: string[] = []
  on('ui.log', (_$: any, e: any) => (logs.push(e.text), { value: undefined }))
  on('session.start', (_$: any, e: any) => ({ sessionId: 's', cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }))
  on('config.list', () => ({ value: [] }))
  const store = new Map<string, unknown>()
  on('store.get', (_$: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', (_$: any, e: any) => (store.set(e.key, e.value), { value: undefined }))
  on('store.delete', (_$: any, e: any) => (store.delete(e.key), { value: undefined }))
  on('session.model', () => ({ value: 'Sonnet 5.5' }))
  let root = '/work'
  on('session.root', () => ({ value: root }))
  on('ui.toast', (_$: any, e: any) => (toasts.push(e.text), { value: undefined }))
  const panes: string[] = []
  on('ui.open', (_$: any, e: any) => (panes.includes(e.id) || panes.push(e.id), { value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: panes.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  on('ui.close', (_$: any, e: any) => (panes.splice(panes.indexOf(e.id), 1), { value: undefined }))
  on('turn.step', async function* (_$: any, e: any) {
    sent.push(e)
    return { turnId: e.turnId, index: e.index, toolUses: [], usage: null, ...reply(e) }
  })
  on('ui.render', ($: any, e: any) => $.ui.resolve(e).Text({ children: 'band below' }))
  return { sent, toasts, logs, store, panes, moveTo: (dir: string) => void (root = dir) }
}

// A toggle by its key (the model id or the effort level): '● Name' when selected, '○ Name' otherwise.
const label = async (band: any, key: string) => {
  const el = await band.find({ key })
  return el && `${el.props.dimColor ? '○' : '●'} ${String(el.props.label).trim()}`
}

async function step($: any, input: any = STEP) {
  const stream = $.turn.step(input)
  for await (const _ of stream) {
  }
  return stream.result
}

describe('quiet-model', () => {
  test('helpers', () => {
    expect(modelOf('claude-opus-5-5')?.name).toBe('Opus')
    expect(modelOf('Sonnet 5.5')?.name).toBe('Sonnet')
    expect(modelOf('gpt')).toBeUndefined()
    // Nothing chosen: the request goes out as it came.
    expect(rewrite(STEP as any, null, null)).toBe(STEP)
    expect(rewrite(STEP as any, 'claude-opus-5-5', 'max')).toEqual({ ...STEP, model: 'claude-opus-5-5', effort: 'max' })
    // Effort alone keeps the model.
    expect(rewrite(STEP as any, null, 'high')).toEqual({ ...STEP, effort: 'high' })
    // Haiku 5.5 has efforts too.
    expect(rewrite(STEP as any, 'claude-haiku-5-5', 'high')).toEqual({ ...STEP, model: 'claude-haiku-5-5', effort: 'high' })
  })

  test('the radios switch the model and the effort of the next requests', async ($, on) => {
    const { sent } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', ...BAND } as any)
    expect(await label(band, SONNET)).toBe('● Sonnet') // the session's model is checked
    expect(await label(band, OPUS)).toBe('○ Opus')
    expect(await label(band, 'xhigh')).toBe('○ X High')
    expect(await band.find({ type: 'Text', text: 'band below' })).toBeDefined() // the band beneath stays

    await band.press({ key: OPUS })
    await band.press({ key: 'max' })
    await step($)
    expect(sent.at(-1)).toMatchObject({ model: OPUS, effort: 'max' })
    expect(await label(band, OPUS)).toBe('● Opus')
    expect(await label(band, SONNET)).toBe('○ Sonnet')
    expect(await label(band, 'max')).toBe('● Max')

    await band.press({ key: 'low' })
    await step($)
    expect(sent.at(-1)).toMatchObject({ model: OPUS, effort: 'low' })
    await band.unmount()
  })

  test('Haiku 5.5 has efforts, and a subagent keeps its own model', async ($, on) => {
    const { sent, toasts } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', ...BAND } as any)
    expect(await label(band, 'medium')).toBe('○ Medium')
    await band.press({ key: HAIKU })
    expect(await label(band, 'medium')).toBe('○ Medium') // the effort group stays
    expect(toasts).toEqual([])
    await band.press({ key: 'low' })
    await step($)
    expect(sent.at(-1)).toMatchObject({ model: HAIKU, effort: 'low' })
    await step($, { ...STEP, agentId: 'a1' })
    expect(sent.at(-1)).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'medium' })
    await band.unmount()
  })

  test('a click changes the fill, never the options drawn', async ($, on) => {
    engine(on)
    await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' } as any)
    const band = await $.ui.mount({ plugin: 'quiet-model', surface: 'desktop', ...BAND } as any)
    const shape = async () => (await band.findAll({ type: 'Box' })).length
    const alts = async () => (await band.findAll({ type: 'Svg' })).map((b: any) => b.props.alt)
    const before = await shape()
    expect(await alts()).toContain('Sonnet, selected')
    await band.press({ key: OPUS })
    await band.press({ key: 'xhigh' })
    expect(await shape()).toEqual(before) // same buttons, same widths, same order
    expect(await alts()).toEqual(expect.arrayContaining(['Opus, selected', 'X High, selected']))
    expect(await alts()).toContain('Sonnet')
    await band.unmount()
  })

  test('each reply is signed with what wrote it', async ($, on) => {
    engine(on, e => ({
      answer: e.agentId ? 'sub' : e.index === 0 ? 'Looking.' : 'All done.',
      stopReason: e.index === 0 ? 'tool_use' : 'end_turn',
    }))
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', ...BAND } as any)
    await band.press({ key: OPUS })
    await band.press({ key: 'xhigh' })
    await step($) // a step that goes on to tools: not the reply's end
    await step($, { ...STEP, index: 1 })
    await step($, { ...STEP, index: 1, agentId: 'a1' })
    const signed = async (text: string) => {
      const row = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', component: 'AssistantMessage', props: { text, isFirstOfReply: true } } as any)
      const found = await row.find({ type: 'Text', text: 'Opus · X High' })
      await row.unmount()
      return found !== undefined
    }
    expect(await signed('All done.')).toBe(true)
    expect(await signed('Looking.')).toBe(false)
    expect(await signed('sub')).toBe(false)
    expect(usedLabel('gpt-x', 3)).toBe('gpt-x · 3')
    await band.unmount()
  })

  test('the bookmark saves the default a new session starts on', async ($, on) => {
    const { store, toasts } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', ...BAND } as any)
    await band.press({ key: OPUS })
    await band.press({ key: 'max' })
    await band.press({ key: 'default' })
    expect([...store.values()]).toContainEqual({ model: OPUS, effort: 'max' })
    expect(toasts.at(-1)).toBe('Default model: Opus · Max')
    expect(String((await band.find({ key: 'default' }))?.props.label)).toBe('★')
    await band.press({ key: 'default' }) // pressed on the default: cleared
    expect(store.get('default')).toBeUndefined()
    expect(String((await band.find({ key: 'default' }))?.props.label)).toBe('☆')
    await band.unmount()
  })

  test('a new session starts on the saved default', async ($, on) => {
    const { sent, store } = engine(on)
    store.set('default', { model: OPUS, effort: 'max' })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await step($)
    expect(sent.at(-1)).toMatchObject({ model: OPUS, effort: 'max' })
  })

  test('the eye hides and shows the model under the replies, and the choice is kept', async ($, on) => {
    const { store } = engine(on, e => ({ answer: 'All done.', stopReason: 'end_turn' }))
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', ...BAND } as any)
    await step($)
    const signed = async () => {
      const row = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', component: 'AssistantMessage', props: { text: 'All done.', isFirstOfReply: true } } as any)
      const found = (await row.find({ type: 'Text', text: 'Sonnet · Medium' })) !== undefined
      await row.unmount()
      return found
    }
    expect(await signed()).toBe(true)
    expect(String((await band.find({ key: 'signature' }))?.props.label)).toBe('◉')
    await band.press({ key: 'signature' })
    expect(await signed()).toBe(false)
    expect(store.get('showSignature')).toBe(false)
    expect(String((await band.find({ key: 'signature' }))?.props.label)).toBe('○')
    await band.press({ key: 'signature' })
    expect(await signed()).toBe(true)
    expect(store.get('showSignature')).toBe(true)
    await band.unmount()
  })

  test('a hidden signature stays hidden in a new session', async ($, on) => {
    const { store } = engine(on, e => ({ answer: 'All done.', stopReason: 'end_turn' }))
    store.set('showSignature', false)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await step($)
    const row = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', component: 'AssistantMessage', props: { text: 'All done.', isFirstOfReply: true } } as any)
    expect(await row.find({ type: 'Text', text: 'Sonnet · Medium' })).toBeUndefined()
    await row.unmount()
  })

  test('the price of rewriting a context in another model\'s cache', () => {
    const [haiku, sonnet, opus, fable] = MODELS
    // 200k tokens at the cache-write rate (1.25x the list price per million)
    expect(Math.round(recacheUsd(200_000, haiku) * 1000) / 1000).toBe(0.125) // above 100k, Haiku's input is $0.50
    expect(Math.round(recacheUsd(80_000, haiku) * 1000) / 1000).toBe(0.01) // up to 100k, $0.10
    expect(Math.round(recacheUsd(200_000, sonnet) * 100) / 100).toBe(0.5)
    expect(Math.round(recacheUsd(200_000, opus) * 100) / 100).toBe(1)
    expect(Math.round(recacheUsd(200_000, fable) * 100) / 100).toBe(2.5)
    expect([formatUsd(0.004), formatUsd(0.186), formatUsd(1), formatUsd(12.34), formatUsd(123.4)]).toEqual(['<$0.01', '$0.19', '$1.00', '$12.3', '$123'])
    expect([formatTokens(373_000), formatTokens(1_250_000)]).toEqual(['373k', '1.3M'])

    const last = { tokens: 200_000, model: SONNET, effort: 'medium' }
    expect(switchCost(last, sonnet, 'medium')).toBeNull() // what is cached: nothing to pay
    expect(switchCost(null, opus, 'medium')).toBeNull() // no request yet
    expect(switchCost(last, opus, 'medium')).toMatchObject({ usd: 1, fits: true, isEffortOnly: false })
    expect(switchCost(last, sonnet, 'high')).toMatchObject({ usd: 0.5, isEffortOnly: true })
    expect(switchCost({ ...last, tokens: 1_200_000 }, haiku, 'low')).toMatchObject({ fits: false }) // over the 1M window
    expect(switchCost(last, haiku, 'low')).toMatchObject({ fits: true })

    expect(optionTip(null, opus)).toBeUndefined()
    expect(optionTip(last, sonnet)).toBeUndefined() // no price of a switch is shown
    expect(optionTip(last, opus)).toBeUndefined()
    expect(optionTip({ ...last, tokens: 1_200_000 }, haiku)).toContain('Does not fit')
    expect(costSvg('<$0.01', true)).toContain('&lt;$0.01')
    expect(costSvg('> 200k', false)).toContain('#e5534b')
  })

  test('no price of a switch is drawn; only a context that does not fit warns', async ($, on) => {
    engine(on, () => ({
      answer: 'ok',
      stopReason: 'end_turn',
      usage: { model: SONNET, input_tokens: 20_000, output_tokens: 5_000, cache_read_input_tokens: 170_000, cache_creation_input_tokens: 5_000 },
    }))
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', ...BAND } as any)
    const figure = async (text: string | RegExp) => (await band.find({ type: 'Text', text })) !== undefined
    await step($) // 200k tokens now cached on Sonnet
    await band.press({ key: OPUS })
    expect(await figure(/≈ \$/)).toBe(false) // 200k on Opus: nothing about dollars
    await band.press({ key: 'high' })
    expect(await figure(/≈ \$/)).toBe(false)
    await band.press({ key: HAIKU })
    expect(await figure(/≈ \$/)).toBe(false)
    await band.unmount()
  })

  test('the spinner turns while Magic Router analyzes', async ($, on) => {
    let clock: any
    magicEngine(on, {
      answer: async () => {
        await clock.sleep(1000)
        return said('pick: Sonnet · Medium\nreason: A feature.')
      },
    })
    clock = mock.clock(on)
    await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'desktop')
    const alts = async () => (await band.findAll({ type: 'Svg' })).map((b: any) => b.props.alt)
    expect(await alts()).not.toContain('Magic Router is analyzing')
    await band.press({ key: 'router' }) // on: analyzes what is in the box
    expect(await alts()).toContain('Magic Router is analyzing')
    expect(spinnerSvg(5)).toContain('rotate(90 12 12)') // a frame is a position of the ring
    expect(spinnerSvg(25)).toBe(spinnerSvg(5)) // and it comes round
    const ring = async () => (await band.findAll({ type: 'Svg' })).find((b: any) => b.props.alt === 'Magic Router is analyzing')?.props.source
    const before = await ring()
    await clock.advance(250) // the ring turns while the analysis lasts
    expect(await ring()).not.toBe(before)
    await clock.advance(750)
    expect(await alts()).not.toContain('Magic Router is analyzing')
    expect(await alts()).toContain('Magic Router has analyzed your message') // a check takes the spinner's place
    expect(checkSvg()).toContain('<path')
    await band.unmount()
  })

  test('helpers for the desktop pictures', () => {
    expect(optionColumns('Haiku')).toBe(6)
    expect(optionSvg('Opus', true, 50)).toContain('<rect')
    expect(optionSvg('Opus', false, 50)).not.toContain('<rect')
    expect(titleSvg()).toContain('>Model<')
    expect(signatureSvg('Opus · High (<x>)')).toContain('Opus · High (&lt;x>)')
    // The invisible label stays inside its box with the button's padding, so no ellipsis is drawn.
    for (const name of ['Haiku', 'Sonnet', 'Max', 'X High']) {
      const cols = optionColumns(name)
      expect(cover(cols).length * 13 + 16).toBeLessThanOrEqual(cols * 8.4)
    }
  })

  test("the app's own menu, touched last, wins over the row", async ($, on) => {
    const { sent } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', ...BAND } as any)
    await band.press({ key: OPUS })
    await band.press({ key: 'max' })
    await step($)
    expect(sent.at(-1)).toMatchObject({ model: OPUS, effort: 'max' })
    await step($) // the app's menu has not moved: the row's choice holds
    expect(sent.at(-1)).toMatchObject({ model: OPUS, effort: 'max' })
    // The person picks Haiku and then high effort in the app's menu: both go out as they are.
    await step($, { ...STEP, model: HAIKU, effort: 'high' })
    expect(sent.at(-1)).toMatchObject({ model: HAIKU, effort: 'high' })
    // A new pick in the row wins again.
    await band.press({ key: SONNET })
    await step($, { ...STEP, model: HAIKU, effort: 'high' })
    expect(sent.at(-1)).toMatchObject({ model: SONNET, effort: 'high' })
    await band.unmount()
  })

  test('the cross hides the row', async ($, on) => {
    engine(on)
    await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' } as any)
    const band = await $.ui.mount({ plugin: 'quiet-model', surface: 'desktop', ...BAND } as any)
    await band.press({ key: 'close' })
    await band.unmount()
    const again = await $.ui.mount({ plugin: 'quiet-model', surface: 'desktop', ...BAND } as any)
    expect(await again.find({ key: OPUS })).toBeUndefined()
    expect(await again.find({ type: 'Text', text: 'band below' })).toBeDefined()
    await again.unmount()
  })

  test('the command hides and shows the row', async ($, on) => {
    engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await $.command.run({ command: 'quiet-model', args: '' } as any)
    const hidden = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', ...BAND } as any)
    expect(await label(hidden, OPUS)).toBeUndefined()
    expect(await hidden.find({ type: 'Text', text: 'band below' })).toBeDefined()
    await hidden.unmount()
    await $.command.run({ command: 'quiet-model', args: '' } as any)
    const shown = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', ...BAND } as any)
    expect(await label(shown, OPUS)).toBe('○ Opus')
    await shown.unmount()
  })

  // ---- Magic Router ----

  // The engine as above, plus what Magic Router asks of it: the draft in the box, the last messages and the
  // analyst's answer. `answers` is what the analyst says (a function of its request, or a fixed text).
  function magicEngine(on: any, opts: { answer?: any; draft?: string; history?: any[]; reply?: (e: any) => any } = {}) {
    const base = engine(on, opts.reply)
    const completes: any[] = []
    const box = { text: opts.draft ?? 'add a dark mode toggle to the settings page' }
    const history = opts.history ?? [
      { role: 'user', text: 'make the settings page', toolUses: [] },
      { role: 'assistant', text: 'Done. Want a dark mode toggle too?', toolUses: [] },
    ]
    on('prompt.read', () => ({ value: { text: box.text, cursor: box.text.length } }))
    on('session.messages', () => ({ value: history }))
    on('model.complete', async ($: any, e: any) => {
      completes.push(e)
      const said = typeof opts.answer === 'function' ? await opts.answer($, e) : opts.answer
      return { value: said ?? { isAnswered: true, text: 'tier: balanced\nreason: A coordinated change.', usage: USAGE } }
    })
    return { ...base, completes, box, history }
  }
  const USAGE = { input_tokens: 1300, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
  const said = (text: string) => ({ isAnswered: true, text, usage: USAGE })

  // The band with its panel open and Magic Router on: what a person does to turn it on.
  // The row and the settings pane, looked into as one: the pane's switches, the row's options.
  async function view($: any, surface: 'terminal' | 'desktop') {
    const band = await $.ui.mount({ plugin: 'quiet-model', surface, ...BAND } as any)
    const pane = await $.ui.mount({ plugin: 'quiet-model', surface, component: 'Pane', requestId: 'quiet-model', props: { bodyColumns: 120 } } as any)
    return {
      find: async (q: any) => (await pane.find(q)) ?? (await band.find(q)),
      findAll: async (q: any) => [...(await band.findAll(q)), ...(await pane.findAll(q))],
      press: async (q: any) => ((await pane.find(q)) ? pane.press(q) : band.press(q)),
      unmount: async () => {
        await pane.unmount()
        await band.unmount()
      },
      band,
      pane,
    }
  }
  async function turnOn(band: any) {
    await band.press({ key: 'magic-switch' })
  }
  // This project's own Magic Router settings, as kept.
  const mine = (store: Map<string, unknown>) => (store.get('projects') as any)?.['/work']
  const text = async (band: any, wanted: string | RegExp) => (await band.find({ type: 'Text', text: wanted })) !== undefined

  test('helpers of Magic Router', () => {
    expect(parseVerdict('tier: normal\nreason: A coordinated change.')).toEqual({ tier: 'normal', reason: 'A coordinated change.' })
    expect(parseVerdict('Tier: HARD\nReason: tricky race condition')).toEqual({ tier: 'hard', reason: 'tricky race condition' })
    expect(parseVerdict('trivial')).toEqual({ tier: 'trivial', reason: '' }) // the tier alone is enough
    expect(parseVerdict('tier: powerful')).toEqual({ tier: 'hard', reason: '' }) // an older name still counts
    expect(parseVerdict('tier: fast')).toEqual({ tier: 'trivial', reason: '' })
    expect(parseVerdict('I cannot decide')).toBeNull()
    expect(parseVerdict('tier: trivial\nreason: ' + 'x'.repeat(200))?.reason.length).toBe(90)
    // The analyst's own pick, as it may write it; its reason may name another model.
    expect(parseVerdict('pick: Opus · X High\nreason: a large risky refactor')).toEqual({ route: 'Opus · X High', reason: 'a large risky refactor' })
    expect(parseVerdict('pick: sonnet - medium\nreason: Opus would be overkill')).toEqual({ route: 'Sonnet · Medium', reason: 'Opus would be overkill' })
    expect(parseVerdict('Fable xhigh')).toEqual({ route: 'Fable · X High', reason: '' })
    expect(parseVerdict('pick: Opus')).toEqual({ route: 'Opus · Medium', reason: '' }) // no effort: Medium
    expect(parseVerdict('pick: Haiku · Low')).toEqual({ route: 'Haiku · Low', reason: '' })
    // An option it was not shown goes to the next allowed one up.
    expect(pickRoute('Opus · X High', 0)).toMatchObject({ model: { name: 'Opus' }, effort: 'max' })
    expect(pickRoute('Fable · High', 0, [...DEFAULT_ALLOWED, 'Fable · High'])).toMatchObject({ model: { name: 'Fable' }, effort: 'high' })
    // Each tier of the earlier answers still asks for a model and an effort.
    expect(pickFor('trivial', 0)).toMatchObject({ model: { name: 'Haiku' }, effort: 'high', note: '' }) // Haiku · Low is not among the usual five: the next one up
    expect(pickFor('simple', 50_000)).toMatchObject({ model: { name: 'Sonnet' }, effort: 'low' })
    expect(pickFor('normal', 50_000)).toMatchObject({ model: { name: 'Sonnet' }, effort: 'medium' })
    expect(pickFor('hard', 50_000)).toMatchObject({ model: { name: 'Opus' }, effort: 'high' })
    expect(pickFor('critical', 50_000)).toMatchObject({ model: { name: 'Opus' }, effort: 'max' })
    expect(pickFor('trivial', 200_000)).toMatchObject({ model: { name: 'Haiku' }, effort: 'high', note: '' }) // Haiku 5.5's window is 1M
    // The analyst is shown the allowed options alone, each with its price and what it is for.
    const usual = analystSystem(DEFAULT_ALLOWED)
    expect(usual).toContain('Haiku · High ($0.1/$0.5, 5x above 100k tokens): A simple but longer task')
    expect(usual).toContain('Sonnet · Medium ($2/$10): A normal coding task')
    expect(usual).not.toContain('Fable')
    expect(analystSystem([...DEFAULT_ALLOWED, 'Fable · High'])).toContain('Fable · High ($10/$50)')
    for (const r of ROUTES) expect(ROUTE_NOTES[r.label]).toBeDefined() // every option has its description
    expect(clampDepth(0)).toBe(1)
    expect(clampDepth(99)).toBe(10)
    expect(clampDelay(0.04)).toBe(0.1)
    expect(clampDelay(1.1 + 0.1 + 0.1)).toBe(1.3) // tenths, never 1.2999999999999998
    expect(clampDelay(60)).toBe(5)
    expect(cleanMagic(null)).toBeNull()
    expect(cleanMagic({ isOn: true, analyst: 'Opus', depth: 99, excerpt: 50, delay: 'x' })).toEqual({ isOn: true, analyst: 'Opus', depth: 10, excerpt: 200, delay: 0.4, guard: 1, analystEffort: 'medium', allowed: DEFAULT_ALLOWED })
    expect(cleanMagic({ isOn: 'yes', analyst: 'Fable', depth: 3, delay: 0.5 })).toEqual({ isOn: false, analyst: 'Haiku', depth: 3, excerpt: 600, delay: 0.5, guard: 1, analystEffort: 'medium', allowed: DEFAULT_ALLOWED })
  })

  test('what the analyst is sent, and what that costs', () => {
    const long = 'a'.repeat(300) + 'b'.repeat(700)
    const prompt = analysisPrompt([{ role: 'user', text: 'hello' }, { role: 'assistant', text: long }], 'go')
    expect(prompt).toContain('[user] hello')
    expect(prompt).toContain('[...]') // a long message keeps its start and its end
    expect(prompt).toContain('b'.repeat(400))
    expect(prompt).not.toContain('b'.repeat(401))
    expect(prompt.endsWith('Next message to route:\ngo')).toBe(true)
    expect(analysisPrompt([], 'go')).toContain('(none)')
    expect(analysisPrompt([], 'x'.repeat(5000)).length).toBeLessThan(1700)
    const [haiku, sonnet, opus] = MODELS
    expect(analysisTokens(5)).toBe(1300)
    expect(analysisTokens(5, 1200)).toBe(2050) // twice the characters per message: more tokens
    const longer = analysisPrompt([{ role: 'assistant', text: 'y'.repeat(5000) }], 'go', 1200)
    expect(longer).toContain('y'.repeat(800)) // the end, two thirds of the excerpt
    expect(longer.length).toBeGreaterThan(prompt.length)
    expect(clampExcerpt(649)).toBe(600)
    expect(clampExcerpt(99_999)).toBe(3000)
    expect([formatAnalysisUsd(analysisUsd(5, haiku)), formatAnalysisUsd(analysisUsd(5, sonnet)), formatAnalysisUsd(analysisUsd(5, opus))]).toEqual(['$0.0001', '$0.003', '$0.005'])
  })

  test('the pictures of the panel', () => {
    expect(switchSvg(true)).toContain('>On<')
    expect(switchSvg(false)).toContain('>Off<')
    expect(switchSvg(true)).not.toBe(switchSvg(false))
    expect(routerSvg(true)).toContain('<rect') // on: the chip, like a selected option
    expect(routerSvg(false)).not.toContain('<rect')
    expect(routerTip(false, 'project')).toBe('Magic Router, off in this project')
    expect(routerTip(true, 'everywhere')).toBe('Magic Router, on in every project')
    expect(segmentsSvg([{ text: 'a <b> & c', color: '#fff' }], 80)).toContain('a &lt;b&gt; &amp; c')
    expect(clipSegments([{ text: 'Sonnet' }, { text: ' — a long reason' }], 12).map(s => s.text).join('')).toBe('Sonnet — a…')
    const lines = wrapSegments([{ text: 'Sonnet', color: 'a' }, { text: ' — one two three four', color: 'b' }], 14)
    expect(lines.map(l => l.map(s => s.text).join(''))).toEqual(['Sonnet — one ', 'two three four'])
    expect(clipSegments([{ text: 'short' }], 40)).toEqual([{ text: 'short' }])
    expect(titleSvg('Analyst', 24)).toContain('height="24"')
  })

  test('Magic Router is off until switched on; the gear opens and closes the settings pane', async ($, on) => {
    const { completes, panes } = magicEngine(on, { draft: '' })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    expect(await band.band.find({ key: 'magic-switch' })).toBeUndefined() // the row holds no settings
    expect(await label(band, 'router')).toBe('○ ✧') // the row's button: off
    await band.band.press({ key: 'details' })
    expect(panes).toEqual(['quiet-model'])
    expect(await label(band.band, 'details')).toBe('● ⚙') // the gear says the pane is open
    expect(String((await band.find({ key: 'magic-switch' }))?.props.label)).toBe('○ Off')
    expect(await band.find({ key: 'analyst-haiku' })).toBeUndefined() // off: the settings stay out of sight
    expect(await text(band.pane, /No default model|None: new sessions start/)).toBe(true) // the default model, first
    await band.press({ key: 'magic-switch' })
    expect(String((await band.find({ key: 'magic-switch' }))?.props.label)).toBe('◉ On')
    expect(await label(band, 'router')).toBe('● ✦') // the row's button says it
    await band.band.press({ key: 'details' })
    expect(panes).toEqual([])
    expect(await label(band.band, 'details')).toBe('○ ⚙')
    await band.press({ key: 'router' }) // and turns it off from the row
    expect(await label(band, 'router')).toBe('○ ✧')
    expect(completes.length).toBe(0) // nothing typed: nothing analyzed
    await band.unmount()
  })

  test('the analysis moves the row, and the next request goes out on it', async ($, on) => {
    const { sent, completes } = magicEngine(on, { reply: () => ({ answer: 'All done.', stopReason: 'end_turn' }) })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await band.press({ key: HAIKU })
    expect(await label(band, HAIKU)).toBe('● Haiku')
    await turnOn(band) // starts at once on what is in the box
    expect(completes.length).toBe(1)
    // The analyst: Haiku 5.5 by its full id, at Low, the draft and the last messages in what it reads.
    expect(completes[0].model).toBe('claude-haiku-5-5')
    expect(completes[0].effort).toBe('medium') // the usual analyst: Haiku · Medium
    expect(completes[0].prompt).toContain('Next message to route:\nadd a dark mode toggle to the settings page')
    expect(completes[0].prompt).toContain('[assistant] Done. Want a dark mode toggle too?')
    expect(completes[0].system).toContain('pick: one option, written as below')
    // The row followed it: Sonnet · Medium.
    expect(await label(band, SONNET)).toBe('● Sonnet')
    expect(await label(band, 'medium')).toBe('● Medium')
    expect(await label(band, HAIKU)).toBe('○ Haiku')
    expect(await text(band, 'Sonnet · Medium — A coordinated change.')).toBe(true)
    await step($, { ...STEP, model: OPUS, effort: 'max' })
    expect(sent.at(-1)).toMatchObject({ model: SONNET, effort: 'medium' })
    // The reply says who picked what wrote it.
    const row = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', component: 'AssistantMessage', props: { text: 'All done.', isFirstOfReply: true } } as any)
    expect(await row.find({ type: 'Text', text: 'Sonnet · Medium (Magic Router)' })).toBeDefined()
    await row.unmount()
    await band.unmount()
  })

  test('each level of need picks its model', async ($, on) => {
    let verdict = 'tier: powerful\nreason: Subtle race condition.'
    const { sent } = magicEngine(on, { answer: () => said(verdict) })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    expect(await label(band, OPUS)).toBe('● Opus')
    expect(await label(band, 'high')).toBe('● High')
    await step($)
    expect(sent.at(-1)).toMatchObject({ model: OPUS, effort: 'high' })
    verdict = 'tier: fast\nreason: A short confirmation.'
    await band.press({ key: 'magic-rerun' })
    expect(await label(band, HAIKU)).toBe('● Haiku')
    expect(await label(band, 'high')).toBe('● High')
    await step($)
    expect(sent.at(-1)).toMatchObject({ model: HAIKU, effort: 'high' })
    expect(await text(band, 'Haiku · High — A short confirmation.')).toBe(true)
    // The analyst's own pick, among the allowed options.
    verdict = 'pick: Sonnet · Low\nreason: One clear edit.'
    await band.press({ key: 'magic-rerun' })
    expect(await text(band, 'Sonnet · Low — One clear edit.')).toBe(true)
    await band.unmount()
  })

  test('a click in the row overrules the analysis for this message', async ($, on) => {
    const { sent } = magicEngine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    await band.press({ key: OPUS })
    expect(await label(band, OPUS)).toBe('● Opus')
    expect(await text(band, /^You picked Opus.*it wins for this message\. Magic Router takes over again with the next one\./)).toBe(true)
    await step($)
    expect(sent.at(-1)).toMatchObject({ model: OPUS })
    expect(await text(band, /^You picked Opus.*for that message\. Magic Router is back from your next one\./)).toBe(true)
    await band.unmount()
  })

  test('the analyst can be changed, and then it thinks a little', async ($, on) => {
    const { completes, store } = magicEngine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    expect(await text(band, /^analysis \$0\.0001/)).toBe(true) // 1300 tokens read and 20 written, at Haiku's $0.10 per million
    await band.press({ key: 'analyst-sonnet' })
    await band.press({ key: 'magic-rerun' })
    expect(await text(band, /^analysis \$0\.003/)).toBe(true) // the same tokens at Sonnet's $2
    expect(completes.at(-1)).toMatchObject({ model: 'claude-sonnet-5-5', effort: 'low' })
    expect(mine(store)).toMatchObject({ isOn: true, analyst: 'Sonnet', depth: 5, delay: 0.4 })
    await band.unmount()
  })

  test('Haiku can think longer before it picks, and Result says how long the analysis took', async ($, on) => {
    let clock: any
    const { completes, store } = magicEngine(on, {
      answer: async () => {
        await clock.sleep(1200)
        return said('pick: Sonnet · Medium\nreason: A feature.')
      },
    })
    clock = mock.clock(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    await band.press({ key: 'analyst-haiku-high' })
    expect(mine(store)).toMatchObject({ analyst: 'Haiku', analystEffort: 'high' })
    expect(await label(band, 'analyst-haiku-high')).toBe('● Haiku · High')
    expect(await label(band, 'analyst-haiku')).toBe('○ Haiku · Low')
    await band.press({ key: 'magic-rerun' })
    await clock.advance(1200)
    expect(completes.at(-1)).toMatchObject({ model: 'claude-haiku-5-5', effort: 'high' })
    expect(await text(band, /^analysis \$0\.0001 · 1\.2 s/)).toBe(true)
    await band.press({ key: 'analyst-opus' }) // Sonnet and Opus stay at Low
    expect(mine(store)).toMatchObject({ analyst: 'Opus', analystEffort: 'low' })
    await band.unmount()
  })

  test('the analyst reads as many messages as asked, and the delay moves by tenths', async ($, on) => {
    const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `message ${i + 1}`, toolUses: [] }))
    const { completes, store } = magicEngine(on, { history })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    expect(completes[0].prompt).toContain('message 8') // the last five of twelve
    expect(completes[0].prompt).not.toContain('message 7')
    for (let i = 0; i < 3; i++) await band.press({ key: 'depth-down' })
    expect(await text(band, '2')).toBe(true)
    await band.press({ key: 'magic-rerun' })
    expect(completes.at(-1).prompt).toContain('message 11')
    expect(completes.at(-1).prompt).not.toContain('message 10')
    for (let i = 0; i < 20; i++) await band.press({ key: 'depth-down' })
    expect(mine(store)).toMatchObject({ depth: 1 }) // never below one
    // The delay: 0.4 seconds to begin with, tenths up and down, within 0.1 and 5.
    expect(await text(band, '0.4')).toBe(true)
    await band.press({ key: 'delay-up' })
    await band.press({ key: 'delay-up' })
    expect(await text(band, '0.6')).toBe(true)
    expect(mine(store)).toMatchObject({ delay: 0.6 })
    for (let i = 0; i < 30; i++) await band.press({ key: 'delay-down' })
    expect(await text(band, '0.1')).toBe(true)
    for (let i = 0; i < 60; i++) await band.press({ key: 'delay-up' })
    expect(await text(band, '5.0')).toBe(true)
    await band.unmount()
  })

  test('a failed or unclear analysis says so and leaves the row alone', async ($, on) => {
    let answer: any = { isAnswered: false, reason: 'api-error', status: 429, error: 'rate_limit', usage: USAGE }
    magicEngine(on, { answer: () => answer })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    expect(await text(band, 'Analysis failed (429). Press ↻ to try again.')).toBe(true)
    expect(await label(band, SONNET)).toBe('● Sonnet') // the session's model, untouched
    answer = said('no idea')
    await band.press({ key: 'magic-rerun' })
    expect(await text(band, "Haiku's answer was unclear. Press ↻ to try again.")).toBe(true)
    answer = { isAnswered: false, reason: 'aborted', usage: USAGE }
    await band.press({ key: 'magic-rerun' })
    expect(await text(band, 'Haiku took too long. Press ↻ to try again.')).toBe(true)
    await band.unmount()
  })

  test('the settings are kept, and a new session starts with them', async ($, on) => {
    const { store } = magicEngine(on)
    store.set('projects', { '/work': { isOn: true, analyst: 'Opus', depth: 7, delay: 2.5 } })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    expect(await label(band, 'router')).toBe('● ✦')
    expect(await text(band, '2.5')).toBe(true)
    expect(await text(band, '7')).toBe(true)
    expect(await label(band, 'analyst-opus')).toBe('● Opus · Low')
    await band.press({ key: 'magic-switch' }) // turned off: kept off
    expect(mine(store)).toMatchObject({ isOn: false, analyst: 'Opus', depth: 7, delay: 2.5 })
    expect(await label(band, 'router')).toBe('○ ✧')
    await band.unmount()
  })

  test('Magic Router applies to this project by default, or everywhere when asked', async ($, on) => {
    const { store, moveTo } = magicEngine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    expect(await label(band, 'scope-project')).toBe('● This project')
    expect(mine(store)).toMatchObject({ isOn: true })
    expect(store.get('everywhere')).toBeUndefined()
    await band.press({ key: 'scope-everywhere' })
    expect(mine(store)).toBeUndefined()
    expect(store.get('everywhere')).toMatchObject({ isOn: true })
    await band.press({ key: 'scope-project' }) // back here only: no other project goes on being routed
    expect(mine(store)).toMatchObject({ isOn: true })
    expect(store.get('everywhere')).toBeUndefined()
    await band.unmount()
    moveTo('/other')
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/other' } as any)
    const elsewhere = await view($, 'terminal')
    expect(await label(elsewhere, 'router')).toBe('○ ✧')
    await elsewhere.unmount()
  })

  test('which settings a project runs on', () => {
    const own = { isOn: false, analyst: 'Opus', depth: 3, excerpt: 600, delay: 2, guard: 0.5, analystEffort: 'low', allowed: DEFAULT_ALLOWED }
    const all = { isOn: true, analyst: 'Haiku', depth: 8, excerpt: 600, delay: 1, guard: 0.5, analystEffort: 'low', allowed: DEFAULT_ALLOWED }
    expect(resolveMagic({ '/a': own }, all, '/a')).toEqual({ settings: own, scope: 'project' }) // its own wins
    expect(resolveMagic({ '/a': own }, all, '/b')).toEqual({ settings: all, scope: 'everywhere' })
    expect(resolveMagic(undefined, undefined, '/b')).toEqual({ settings: DEFAULT_MAGIC, scope: 'project' }) // off
  })

  test('the excerpt of each message is a setting, and the analyst gets that much', async ($, on) => {
    const long = 'a'.repeat(300) + 'MIDDLE' + 'z'.repeat(3000)
    const { completes, store } = magicEngine(on, { history: [{ role: 'assistant', text: long, toolUses: [] }] })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    expect(await text(band, '600')).toBe(true) // 600 characters by default
    expect(completes[0].prompt).not.toContain('z'.repeat(500)) // 400 of them from the end
    await band.press({ key: 'excerpt-up' })
    expect(mine(store)).toMatchObject({ excerpt: 700 })
    await band.press({ key: 'excerpt-down' })
    for (let i = 0; i < 9; i++) await band.press({ key: 'excerpt-down' })
    expect(mine(store)).toMatchObject({ excerpt: 200 }) // never below 200
    await band.unmount()
  })

  test('the tally: what the routed messages cost, compared with Opus', () => {
    const models = { sonnet: { id: 'claude-sonnet-5-5', name: 'Sonnet', inputUsd: 2 } as any, opus: { id: 'claude-opus-5-5', name: 'Opus', inputUsd: 4 } as any }
    const use = { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 20000, cache_creation_input_tokens: 0 }
    // Sonnet: 1000 + 20000 * 0.1 + 500 * 5 = 5500 input-price tokens, $0.011. Opus reads its cache at 0.05x:
    // 1000 + 20000 * 0.05 + 500 * 5 = 4500 tokens at $4 per million, $0.018.
    let t = tallyStep(NO_TALLY, models.sonnet, use, null)
    expect(Math.abs(t.actualUsd - (0.011))).toBeLessThan(1e-9)
    expect(Math.abs(t.opusUsd - (0.018))).toBeLessThan(1e-9)
    t = tallyReply(tallyReply(t, 'Sonnet'), 'Haiku')
    t = tallyAnalysis(t, 0.001)
    expect(countsText(t)).toBe('Haiku 1 · Sonnet 1')
    expect(offOpus(t)).toBe(2)
    expect(Math.abs(netUsd(t) - (0.006))).toBeLessThan(1e-9)
    expect(formatNet(t)).toBe('≈ $0.006 saved vs Opus · High')
    // After a switch the new model wrote the whole context to its cache; Opus would have read it.
    const switched = tallyStep(NO_TALLY, models.sonnet, { ...use, cache_read_input_tokens: 0, cache_creation_input_tokens: 20000 }, { tokens: 20000, model: 'claude-opus-5-5' })
    expect(Math.abs(switched.actualUsd - (((1000 + 20000 * 1.25 + 2500) / 1e6) * 2))).toBeLessThan(1e-9)
    expect(Math.abs(switched.opusUsd - (((1000 + 20000 * 0.05 + 2500) / 1e6) * 4))).toBeLessThan(1e-9)
    // Each model reads its cache at its own rate: Opus half, Fable a quarter of the usual tenth.
    const [haiku, sonnet, opus, fable] = MODELS
    expect([haiku, sonnet, opus, fable].map(m => m.cacheRead)).toEqual([0.1, 0.1, 0.05, 0.025])
    const read = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 0 }
    expect(Math.abs(tallyStep(NO_TALLY, opus, read, null).actualUsd - 0.2)).toBeLessThan(1e-9) // $4 * 0.05
    expect(Math.abs(tallyStep(NO_TALLY, fable, read, null).actualUsd - 0.25)).toBeLessThan(1e-9) // $10 * 0.025
    expect(formatNet(tallyAnalysis(NO_TALLY, 0.5))).toBe('≈ $0.50 lost vs Opus · High')
    expect(formatNet(NO_TALLY)).toBe('≈ even vs Opus · High')
  })

  test('what Magic Router chose, as a tree and as a Sankey diagram', () => {
    let t = NO_TALLY
    t = tallyReply(t, 'Sonnet', 'Sonnet · Medium')
    t = tallyReply(t, 'Sonnet', 'Sonnet · Medium')
    t = tallyReply(t, 'Opus', 'Opus · High')
    t = tallyReply(t, 'Haiku')
    expect(routeTree(t)).toEqual([
      { name: 'Haiku', count: 1, children: [] },
      { name: 'Sonnet', count: 2, children: [{ name: 'Medium', count: 2 }] },
      { name: 'Opus', count: 1, children: [{ name: 'High', count: 1 }] },
    ])
    expect(treeLines(t)).toEqual(['Magic Router  4', '├─ Haiku  1', '├─ Sonnet  2', '│  └─ Medium  2', '└─ Opus  1', '   └─ High  1'])
    const svg = sankeySvg(t, 400)
    for (const word of ['Haiku', 'Sonnet', 'Medium', 'Opus', 'High']) expect(svg).toContain(`>${word} <`)
    expect(svg.match(/<path /g)?.length).toBe(5) // three bands to the models, two to the efforts
    // A tally kept from before efforts were counted still draws.
    const old = { counts: { Sonnet: 1 }, total: 1, analyses: 0, analysisUsd: 0, actualUsd: 0, opusUsd: 0 } as any
    expect(routeTree(old)).toEqual([{ name: 'Sonnet', count: 1, children: [] }])
    expect(fullTally(tallyReply(old, 'Opus', 'Opus · High')).routes).toEqual({ 'Opus · High': 1 })
  })

  test('the Totals row counts what Magic Router routed', async ($, on) => {
    const usage = { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 20000, cache_creation_input_tokens: 0 }
    magicEngine(on, { reply: () => ({ answer: 'All done.', stopReason: 'end_turn', usage }) })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    expect(await text(band, 'No message routed yet.')).toBe(true)
    await band.press({ key: 'magic-switch' }) // off: the totals stay
    expect(await text(band, 'No message routed yet.')).toBe(true)
    await band.press({ key: 'magic-switch' })
    await step($) // Magic Router put Sonnet · Medium in the row
    expect(await text(band, 'Sonnet 1')).toBe(true)
    expect(await text(band, '└─ Sonnet  1')).toBe(true) // the tree, in the terminal
    expect(await text(band, /1 of 1 off Opus\s+analyses \$0\.\d+\s+≈ .* saved vs Opus/)).toBe(true)
    await band.press({ key: OPUS }) // the person's own pick: not Magic Router's work
    await step($)
    expect(await text(band, 'Sonnet 1')).toBe(true)
    expect(await text(band, /1 of 1 off Opus/)).toBe(true)
    await band.unmount()
  })

  test('Totals can be read for this session, this project or everywhere, and are kept', async ($, on) => {
    const usage = { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 20000, cache_creation_input_tokens: 0 }
    const { store } = magicEngine(on, { reply: () => ({ answer: 'All done.', stopReason: 'end_turn', usage }) })
    // Earlier conversations: four Haiku messages here, nine more elsewhere.
    const old = { ...NO_TALLY, counts: { Haiku: 4 }, routes: { 'Haiku · High': 4 }, total: 4 }
    store.set('totals', { everywhere: { ...old, counts: { Haiku: 13 }, routes: { 'Haiku · High': 13 }, total: 13 }, projects: { '/work': old } })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    await step($) // Magic Router put Sonnet · Medium in the row: one routed message
    expect(await label(band, 'totals-everywhere')).toBe('● Everywhere') // everyone's, to begin with
    expect(await text(band, /Haiku 13 · Sonnet 1/)).toBe(true)
    await band.press({ key: 'totals-project' })
    expect(await text(band, /Haiku 4 · Sonnet 1/)).toBe(true)
    await band.press({ key: 'totals-session' })
    expect(await text(band, /Sonnet 1/)).toBe(true) // this conversation alone
    expect(await text(band, /Haiku (4|13)/)).toBe(false)
    // Kept: counts and costs only.
    const kept = store.get('totals') as any
    expect(kept.everywhere.total).toBe(14)
    expect(kept.projects['/work'].total).toBe(5)
    expect(JSON.stringify(kept)).not.toContain('dark mode')
    await band.unmount()
  })

  test('the guard keeps the current model when a switch down costs too much', () => {
    const opus = { id: 'claude-opus-5-5', name: 'Opus', inputUsd: 4 } as any
    const sonnet = { id: 'claude-sonnet-5-5', name: 'Sonnet', inputUsd: 2 } as any
    const haiku = { id: 'claude-haiku-5-5', name: 'Haiku', inputUsd: 1 } as any
    const ctx = { tokens: 344_000, model: 'claude-opus-5-5', effort: 'high', at: 1_000 }
    // 344k at Sonnet's cache-write price is $0.86: above $0.50, the model is kept.
    expect(guardPick({ model: sonnet }, ctx, 0.5, 2_000)).toMatchObject({ model: { name: 'Opus' }, effort: 'high' })
    expect(guardPick({ model: sonnet }, ctx, 1, 2_000)).toBeNull() // under the limit: follow the analysis
    expect(guardPick({ model: sonnet }, ctx, 0, 2_000)).toBeNull() // off
    expect(guardPick({ model: haiku }, ctx, 0.5, 2_000)).toBeNull() // 344k at Haiku's price is $0.43: under the limit
    expect(Math.round((guardPick({ model: haiku }, ctx, 0.4, 2_000)?.usd ?? 0) * 100)).toBe(43)
    expect(guardPick({ model: opus }, { ...ctx, model: 'claude-sonnet-5-5' }, 0.5, 2_000)).toBeNull() // up: never held
    expect(guardPick({ model: sonnet }, ctx, 0.5, 1_000 + 3_600_001)).toBeNull() // an hour without a request: cache gone
    expect(guardPick({ model: sonnet }, null, 0.5, 2_000)).toBeNull() // nothing sent yet
    expect(clampGuard(9)).toBe(5)
    expect(clampGuard(0.04)).toBe(0)
  })

  test('a switch down that costs too much is held, and the result says why', async ($, on) => {
    const usage = { input_tokens: 344_000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    const { store } = magicEngine(on, { reply: () => ({ answer: 'ok', stopReason: 'end_turn', usage }) })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await band.press({ key: OPUS })
    await step($, { ...STEP, model: OPUS, effort: 'high' }) // a 344k context sits in Opus's cache
    await turnOn(band) // the analysis says normal: Sonnet · Medium would rewrite it for $0.86, under the usual $1
    expect(await label(band, SONNET)).toBe('● Sonnet')
    await band.press({ key: OPUS })
    await step($, { ...STEP, model: OPUS, effort: 'high' })
    for (let i = 0; i < 5; i++) await band.press({ key: 'guard-down' }) // $0.9 ... $0.5: now the switch costs too much
    expect(mine(store)).toMatchObject({ guard: 0.5 })
    await band.press({ key: 'magic-rerun' })
    expect(await label(band, OPUS)).toBe('● Opus')
    expect(await text(band, /kept: switching down to Sonnet · Medium would cost ≈ \$0\.86/)).toBe(true)
    for (let i = 0; i < 5; i++) await band.press({ key: 'guard-up' })
    expect(mine(store)).toMatchObject({ guard: 1 })
    await band.press({ key: 'magic-rerun' })
    expect(await label(band, SONNET)).toBe('● Sonnet')
    await band.press({ key: 'guard-down' })
    for (let i = 0; i < 20; i++) await band.press({ key: 'guard-down' })
    expect(mine(store)).toMatchObject({ guard: 0 }) // off
    expect(await text(band, 'always follow the analysis')).toBe(true)
    await band.unmount()
  })

  test('Magic Router picks only among the allowed models and efforts', async ($, on) => {
    // A level that is not allowed goes to the next one up that is allowed, else to the nearest one below.
    expect(pickFor('normal', 0, ['Haiku · Low', 'Opus · High'])).toMatchObject({ model: { name: 'Opus' }, effort: 'high' })
    expect(pickFor('trivial', 0, ['Sonnet · Medium', 'Opus · Max'])).toMatchObject({ model: { name: 'Sonnet' }, effort: 'medium' })
    expect(pickFor('critical', 0, ['Haiku · Low', 'Sonnet · High'])).toMatchObject({ model: { name: 'Sonnet' }, effort: 'high' })
    expect(pickFor('hard', 0, ['Sonnet · Low', 'Sonnet · Max'])).toMatchObject({ model: { name: 'Sonnet' }, effort: 'max' })
    expect(pickFor('trivial', 1_200_000, ['Haiku · Low', 'Opus · Low'])).toMatchObject({ model: { name: 'Haiku' } }) // beyond every window: kept as asked
    expect(pickFor('normal', 0, [])).toMatchObject({ model: { name: 'Sonnet' }, effort: 'medium' }) // none: the usual five
    expect(cleanAllowed(['Opus · Max', 'nonsense', 'Haiku'])).toEqual(['Haiku · Low', 'Opus · Max']) // in order, known ones only; Haiku 4.5's 'Haiku' is Haiku 5.5 at Low
    expect(cleanAllowed(undefined)).toEqual(DEFAULT_ALLOWED)
    expect(pickFor('critical', 0, [...DEFAULT_ALLOWED.filter(l => l !== 'Opus · Max'), 'Fable · High'])).toMatchObject({ model: { name: 'Fable' }, effort: 'high' }) // Fable, once allowed, sits above Opus
    expect(pickFor('critical', 0)).toMatchObject({ model: { name: 'Opus' } }) // and stays out by default

    const { store, toasts } = magicEngine(on, { answer: () => said('tier: normal\nreason: A feature.') })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    expect(await label(band, 'allow-sonnet-medium')).toBe('● Medium')
    expect(await label(band, 'allow-sonnet-high')).toBe('○ High')
    await band.press({ key: 'allow-sonnet-medium' }) // Sonnet · Medium no longer allowed
    await band.press({ key: 'allow-sonnet-high' })
    expect(mine(store).allowed).toEqual(['Haiku · High', 'Sonnet · Low', 'Sonnet · High', 'Opus · High', 'Opus · Max'])
    await band.press({ key: 'magic-rerun' })
    expect(await label(band, 'high')).toBe('● High') // normal now lands on Sonnet · High, the next one up
    for (const key of ['allow-haiku-high', 'allow-sonnet-low', 'allow-sonnet-high', 'allow-opus-high', 'allow-opus-max']) await band.press({ key })
    expect(toasts).toContain('Magic Router needs at least one model to pick') // the last one stays
    expect(mine(store).allowed).toEqual(['Opus · Max'])
    await band.unmount()
  })

  test('what an edit of the draft leads to', () => {
    const on = { isOn: true, analyst: 'Haiku', depth: 5, excerpt: 600, delay: 0.5, guard: 0.5, analystEffort: 'low', allowed: DEFAULT_ALLOWED } as const
    expect(planEdit('add a dark mode toggle', on, false, false)).toEqual({ kind: 'wait', ms: 500 }) // after the pause, the one set
    expect(planEdit('add a dark mode toggle', { ...on, delay: 1.3 }, false, false)).toEqual({ kind: 'wait', ms: 1300 })
    expect(planEdit('add a dark mode toggle', on, false, true)).toEqual({ kind: 'now' }) // turned on, or asked again
    expect(planEdit('a', on, false, false)).toEqual({ kind: 'idle' }) // too short
    expect(planEdit('/model', on, false, false)).toEqual({ kind: 'idle' }) // a command is not a task
    expect(planEdit('add a dark mode toggle', on, true, false)).toEqual({ kind: 'skip' }) // the person picked in the row
    expect(planEdit('add a dark mode toggle', { ...on, isOn: false }, false, false)).toEqual({ kind: 'skip' })
  })

  test('a message sent while the analysis is still running waits for it, a moment', async ($, on) => {
    let clock: any
    const { sent } = magicEngine(on, {
      answer: async () => {
        await clock.sleep(500)
        return said('tier: powerful\nreason: Subtle bug.')
      },
    })
    clock = mock.clock(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band) // the analysis starts, and answers in half a second
    const going = step($) // the message goes out meanwhile
    await clock.advance(500)
    await going
    expect(sent.at(-1)).toMatchObject({ model: OPUS, effort: 'high' })
    await band.unmount()
  })

  test('an analysis that is too slow does not hold the message, nor land on the next one', async ($, on) => {
    let clock: any
    const { completes, sent } = magicEngine(on, {
      answer: async () => {
        await clock.sleep(10_000)
        return said('tier: powerful\nreason: Late.')
      },
    })
    clock = mock.clock(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'terminal')
    await turnOn(band)
    expect(completes.length).toBe(1)
    const going = step($)
    await clock.advance(2000) // two seconds is all a message waits
    await going
    expect(sent.at(-1)).toMatchObject({ model: SONNET, effort: 'medium' }) // as it came: the session's own
    await clock.advance(20_000)
    expect(await label(band, OPUS)).toBe('○ Opus') // the late answer was dropped
    expect(await label(band, SONNET)).toBe('● Sonnet')
    await band.unmount()
  })

  test('on the desktop, the row, the gear and the pane are pictures', async ($, on) => {
    magicEngine(on)
    await $.session.start({ surface: 'desktop', isInteractive: true, cwd: '/work' } as any)
    const band = await view($, 'desktop')
    const alts = async () => (await band.findAll({ type: 'Svg' })).map((b: any) => b.props.alt)
    expect(await alts()).toContain('Magic Router, off in this project') // the row's button
    expect(await alts()).toContain('Settings: default model and Magic Router') // the gear
    // In the pane, every column is upside down in the tree, so a row's note is painted over the rows below it.
    const columns = await band.pane.findAll({ type: 'Box' })
    expect(columns.some((b: any) => b.props.flexDirection === 'column-reverse')).toBe(true)
    expect(columns.some((b: any) => b.props.flexDirection === 'column')).toBe(false)
    expect(await alts()).toEqual(expect.arrayContaining(['Default model', 'Magic Router', 'Magic Router, off']))
    expect(await alts()).not.toContain('Analyst') // off: only the switch
    await band.press({ key: 'magic-switch' })
    expect(await alts()).toEqual(expect.arrayContaining(['Magic Router, on in this project', 'Magic Router, on', 'Analyst', 'Haiku · Medium, selected', 'Context', 'Result']))
    expect(await alts()).toEqual(expect.arrayContaining(['5', 'messages', 'Delay', '0.4', 'seconds after you stop typing']))
    await band.press({ key: 'delay-up' })
    expect(await alts()).toContain('0.5')
    await band.unmount()
  })
})
