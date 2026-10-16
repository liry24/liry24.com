import { defineCatalog, type Spec } from '@json-render/core'
import { schema } from '@json-render/vue/schema'
import { z } from 'zod'

export const composerModels = [
    'works',
    'arts',
    'careers',
    'ranks',
    'skills',
    'socials',
    'posts',
] as const
export type ComposerModel = (typeof composerModels)[number]
const selection = z.object({
    model: z.enum(composerModels).optional(),
    entryId: z.string().min(1).max(200).optional(),
})
export const composerRequest = selection
    .extend({
        prompt: z.string().trim().min(1).max(2000),
        locale: z.enum(['ja', 'en']),
        timeZone: z
            .string()
            .max(100)
            .refine((value) => {
                try {
                    new Intl.DateTimeFormat('en', { timeZone: value })
                    return true
                } catch {
                    return false
                }
            }),
        context: selection.strict().optional(),
    })
    .strict()
    .refine((value) => !value.entryId || value.model, 'An entry needs a model')
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
export const composerCatalog = defineCatalog(schema, {
    components: {
        Panel: { props: z.object({}), slots: ['default'], description: 'Main form container' },
        Field: { props: z.object({ name: z.string() }), description: 'An existing editable field' },
        Schedule: { props: z.object({}), description: 'Review a requested publication time' },
        Results: { props: z.object({}), description: 'Select an existing entry' },
        Action: {
            props: z.object({ kind: z.enum(['save', 'editor', 'list', 'settings']) }),
            description: 'An explicit user action',
        },
    },
    actions: {},
})

export function composerCandidates(plan: ComposerPlan) {
    const candidate = (id: string, type: string, props: Record<string, unknown>) => ({
        id,
        element: { type, props },
    })
    const nodes = [candidate('panel', 'Panel', {})]
    if (plan.intent === 'create' || plan.intent === 'edit') {
        for (const field of plan.fields.filter((field) => plan.visibleFields.includes(field.key)))
            nodes.push(candidate(field.key, 'Field', { name: field.key }))
        if (plan.model === 'posts' && plan.datePurpose === 'publication')
            nodes.push(candidate('schedule', 'Schedule', {}))
        nodes.push(
            candidate('action', 'Action', { kind: plan.model === 'posts' ? 'editor' : 'save' }),
        )
    } else if (plan.intent === 'settings') {
        nodes.push(candidate('action', 'Action', { kind: 'settings' }))
    } else if (plan.intent !== 'clarify') {
        nodes.push(candidate('results', 'Results', {}))
        if (plan.model) nodes.push(candidate('action', 'Action', { kind: 'list' }))
    }
    return nodes
}

export function defaultComposerSpec(plan: ComposerPlan): Spec {
    const nodes = composerCandidates(plan)
    return {
        root: 'panel',
        elements: Object.fromEntries(
            nodes.map((node) => [
                node.id,
                {
                    ...node.element,
                    children: node.id === 'panel' ? nodes.slice(1).map((child) => child.id) : [],
                },
            ]),
        ),
    }
}

// Only app-owned fields and actions may appear in a rendered form.
export function validComposerSpec(spec: Spec, plan: ComposerPlan): boolean {
    if (!composerCatalog.validate(spec).success || Object.keys(spec.elements).length > 24)
        return false
    const candidates = composerCandidates(plan)
    const seen = new Set<string>()
    const recipes = new Set<string>()
    function visit(id: string): boolean {
        const node = spec.elements[id]
        if (!node || seen.has(id) || node.on || node.visible || node.repeat || node.slots)
            return false
        seen.add(id)
        const recipe = candidates.find(
            (item) =>
                item.element.type === node.type &&
                JSON.stringify(item.element.props) === JSON.stringify(node.props),
        )
        if (!recipe || recipes.has(recipe.id)) return false
        recipes.add(recipe.id)
        if (node.type !== 'Panel' && node.children?.length) return false
        return (node.children ?? []).every(visit)
    }
    return (
        visit(spec.root) &&
        spec.elements[spec.root]?.type === 'Panel' &&
        seen.size === Object.keys(spec.elements).length &&
        candidates.every((node) => recipes.has(node.id))
    )
}

export type ComposerEvent =
    | { type: 'plan'; plan: ComposerPlan }
    | { type: 'step'; spec: Spec }
    | { type: 'complete'; spec: Spec; fallback: boolean }
    | { type: 'error'; message: string }
