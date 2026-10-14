export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

// What the last request of the main conversation ran on, after this mod's choice.
export type Used = {
  model: string
  effort: Effort | number | null // null: the model has no effort setting
}

// The model and effort new sessions start on, saved with the bookmark.
export type Default = { model: string; effort: Effort | null }

// Magic Router: the model that reads the draft, how many of the last messages it reads, how many characters
// of each it keeps (its start and its end), and how long it waits after the last keystroke (seconds, tenths)
// before it starts.
export type Analyst = 'Haiku' | 'Sonnet' | 'Opus'
export type Magic = {
  isOn: boolean
  analyst: Analyst
  analystEffort: Effort // Haiku's: low, medium or high; Sonnet and Opus read at low
  depth: number
  excerpt: number
  delay: number
  guard: number // USD, 0 off
  allowed: string[] // the models and efforts it may pick, by name: 'Haiku', 'Sonnet · Medium'
}
// Where those settings apply: this project alone, or every project without settings of its own.
export type Scope = 'project' | 'everywhere'

// What the analysis stands at, as the panel's Result line says it.
export type MagicResult = {
  status: 'idle' | 'busy' | 'manual' | 'done' | 'error'
  model?: string // the model id it picked
  effort?: Effort | null
  reason?: string // the analyst's own words, a few of them
  note?: string // what the router changed on its own (a model too small for the context)
  message?: string // why it failed
  analyst?: string // who read
  isSent?: boolean // 'manual': the picked model went out with that message; the next one is analyzed again
  tokens?: number // what the analysis read, as the API counted it
  usd?: number // and what that cost at the analyst's list input price
  ms?: number // how long the analysis took
}

// What Magic Router did this session, in the session's memory only.
export type Tally = {
  counts: Record<string, number> // routed messages, by the name of the model that answered
  routes: Record<string, number> // the same, by model and effort: 'Sonnet · Medium', or 'Haiku' alone
  total: number // routed messages in all
  analyses: number
  analysisUsd: number // what the analyses cost, at the analyst's list input price
  actualUsd: number // what the routed requests used, at each model's list prices
  opusUsd: number // the same tokens at Opus's prices, the cache rewrite after a switch left out
}

declare module 'claude-code' {
  interface PluginState {
    'quiet-model': {
      model: string | null // the chosen model id; null keeps the session's
      effort: Effort | null // the chosen effort; null keeps the session's
      used: Used | null
      isHidden: boolean
      savedDefault: Default | null
      showSignature: boolean // the model is named under each reply
      context: { tokens: number; model: string; effort: string; at?: number } | null // what the last request left in the prompt cache
      isDefaultApplied: boolean // the saved default was put in place at this session's start
      appModel: string | null // the app's own menu at the last request; null: unknown since a pick here
      replies: { tail: string; label: string }[] // the end of the session's last replies and what wrote them
      appEffort: string | null // likewise, the effort as a string ('none' for a model without one)
      magic: Magic // Magic Router's settings in this project; kept across sessions ($.store)
      magicScope: Scope // where they come from and apply
      magicResult: MagicResult
      tally: Tally
      totalsScope: 'session' | 'project' | 'everywhere' // whose Totals the panel shows
      spinFrame: number // the spinner's position while an analysis runs, from the clock
      isDetailOpen: boolean // the panel under the row
    }
  }
}
