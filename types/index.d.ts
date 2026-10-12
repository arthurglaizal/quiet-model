export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

// What the last request of the main conversation ran on, after this mod's choice.
export type Used = {
  model: string
  effort: Effort | number | null // null: the model has no effort setting
}

// The model and effort new sessions start on, saved with the bookmark.
export type Default = { model: string; effort: Effort | null }

declare module 'claude-code' {
  interface PluginState {
    'quiet-model': {
      model: string | null // the chosen model id; null keeps the session's
      effort: Effort | null // the chosen effort; null keeps the session's
      used: Used | null
      isHidden: boolean
      savedDefault: Default | null
      isDefaultApplied: boolean // the saved default was put in place at this session's start
      appModel: string | null // the app's own menu at the last request; null: unknown since a pick here
      replies: { tail: string; label: string }[] // the end of the session's last replies and what wrote them
      appEffort: string | null // likewise, the effort as a string ('none' for a model without one)
    }
  }
}
