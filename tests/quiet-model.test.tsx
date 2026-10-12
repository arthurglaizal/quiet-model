import { describe, expect, test } from 'claude-code/testing'

import { cover, modelOf, signatureSvg, usedLabel, optionColumns, optionSvg, rewrite, titleSvg } from '../hooks/register'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120 } }
const HAIKU = 'claude-haiku-4-5-20251001'
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
  on('ui.toast', (_$: any, e: any) => (toasts.push(e.text), { value: undefined }))
  on('turn.step', async function* (_$: any, e: any) {
    sent.push(e)
    return { turnId: e.turnId, index: e.index, toolUses: [], usage: null, ...reply(e) }
  })
  on('ui.render', ($: any, e: any) => $.ui.resolve(e).Text({ children: 'band below' }))
  return { sent, toasts, logs, store }
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
    // Haiku has no effort setting: none is sent.
    expect(rewrite(STEP as any, 'claude-haiku-4-5-20251001', 'high')).toEqual({ turnId: 't', index: 0, model: 'claude-haiku-4-5-20251001', messageCount: 3 })
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

  test('Haiku has no effort, and a subagent keeps its own model', async ($, on) => {
    const { sent, toasts } = engine(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const band = await $.ui.mount({ plugin: 'quiet-model', surface: 'terminal', ...BAND } as any)
    expect(await label(band, 'medium')).toBe('○ Medium')
    await band.press({ key: HAIKU })
    // Haiku has no effort setting: the effort group is gone.
    expect(await label(band, 'medium')).toBeUndefined()
    expect(toasts).toEqual([])
    await band.press({ key: SONNET })
    expect(await label(band, 'medium')).toBe('○ Medium') // back with a model that has one
    await band.press({ key: HAIKU })
    await step($)
    expect(sent.at(-1)).toEqual({ turnId: 't', index: 0, model: HAIKU, messageCount: 3 })
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
})
