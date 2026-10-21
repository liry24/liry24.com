import type { z } from 'zod'

import type { composerModels, composerItemInput, composerRequest } from '../utils/adminComposer'

export type ComposerModel = (typeof composerModels)[number]

export type ComposerItemInput = z.infer<typeof composerItemInput>

export type ComposerRequest = z.infer<typeof composerRequest>

export type ComposerField = {
    key: string
    label: string
    kind: string
    required?: boolean
    hasDefault?: boolean
    values?: readonly string[]
    accept?: readonly string[]
}

export type ComposerPlan = {
    model: ComposerModel | null
    intent: 'create' | 'search' | 'edit' | 'manage' | 'settings' | 'clarify'
    entryId?: string
    fields: ComposerField[]
    visibleFields: string[]
    values: Record<string, string | string[]>
    datePurpose: 'none' | 'publication' | 'creation'
    publishAt: string
    timeZone: string
    dateIncomplete: boolean
    query: string
    results: { id: string; model: ComposerModel; title: string }[]
    total: number
}

export type ComposerItem = ComposerItemInput & { plan?: ComposerPlan; error?: string }

export type ComposerBatch = { requestId: string; items: ComposerItem[]; notice?: string }
