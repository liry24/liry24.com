import { defineCatalog, type Spec, type Experimental_CompositionCandidate } from '@json-render/core'
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
export const composerRequest = z
    .object({
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
        model: z.enum(composerModels).optional(),
        entryId: z.string().min(1).max(200).optional(),
    })
    .strict()
    .refine((value) => !value.entryId || value.model, 'An entry needs a model')
export type ComposerRequest = z.infer<typeof composerRequest>
export type ComposerField = {
    key: string
    label: string
    kind: string
    required?: boolean
    values?: readonly string[]
    accept?: readonly string[]
}
export type ComposerPlan = {
    model: ComposerModel | null
    intent: 'create' | 'search' | 'edit' | 'manage' | 'settings' | 'clarify'
    entryId?: string
    fields: ComposerField[]
    values: Record<string, string | string[]>
    publishAt: string
    timeZone: string
    dateIncomplete: boolean
    query: string
    results: { id: string; title: string }[]
    total: number
}
export const composerCatalog = defineCatalog(schema, {
    components: {
        Panel: { props: z.object({}), slots: ['default'], description: 'Main form container' },
        Group: {
            props: z.object({ columns: z.enum(['one', 'two']) }),
            slots: ['default'],
            description: 'Related fields',
        },
        Field: { props: z.object({ name: z.string() }), description: 'An existing editable field' },
        Schedule: { props: z.object({}), description: 'Review a post publication date and time' },
        Results: { props: z.object({}), description: 'Select an existing entry' },
        Action: {
            props: z.object({ kind: z.enum(['save', 'editor', 'list', 'settings']) }),
            description: 'An explicit user action',
        },
    },
    actions: {},
})

export function composerCandidates(plan: ComposerPlan): Experimental_CompositionCandidate[] {
    const candidate = (
        id: string,
        type: string,
        props: Record<string, unknown>,
        description: string,
    ) => ({ id, element: { type, props }, description, root: type === 'Panel' })
    const nodes = [
        candidate('panel', 'Panel', {}, 'Required root'),
        candidate(
            'group',
            'Group',
            { columns: 'two' },
            'Optional compact group for related short fields',
        ),
    ]
    if (plan.intent === 'create' || plan.intent === 'edit') {
        for (const field of plan.fields)
            nodes.push(
                candidate(
                    field.key,
                    'Field',
                    { name: field.key },
                    `${field.label} (${field.kind})${field.required || field.key in plan.values ? '; REQUIRED' : '; optional'}`,
                ),
            )
        if (plan.model === 'posts')
            nodes.push(
                candidate('schedule', 'Schedule', {}, 'Required publication date and time review'),
            )
        nodes.push(
            candidate(
                'action',
                'Action',
                { kind: plan.model === 'posts' ? 'editor' : 'save' },
                'REQUIRED final explicit action',
            ),
        )
    } else if (plan.intent === 'settings') {
        nodes.push(
            candidate('action', 'Action', { kind: 'settings' }, 'Required settings navigation'),
        )
    } else if (plan.model) {
        nodes.push(candidate('results', 'Results', {}, 'Required matching entries'))
        nodes.push(
            candidate('action', 'Action', { kind: 'list' }, 'Required open full management screen'),
        )
    }
    return nodes
}

export function defaultComposerSpec(plan: ComposerPlan): Spec {
    const nodes = composerCandidates(plan).filter((node) => node.id !== 'group')
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

// The model can arrange app-owned recipes, never introduce props, actions, or bindings.
export function validComposerSpec(spec: Spec, plan: ComposerPlan, complete = true): boolean {
    if (!composerCatalog.validate(spec).success || Object.keys(spec.elements).length > 24)
        return false
    const candidates = composerCandidates(plan)
    const seen = new Set<string>()
    const recipes = new Set<string>()
    function visit(id: string, depth: number): boolean {
        const node = spec.elements[id]
        if (
            !node ||
            seen.has(id) ||
            depth > 4 ||
            node.on ||
            node.visible ||
            node.repeat ||
            node.slots
        )
            return false
        seen.add(id)
        const recipe = candidates.find(
            (item) =>
                item.element.type === node.type &&
                JSON.stringify(item.element.props) === JSON.stringify(node.props),
        )
        if (!recipe || recipes.has(recipe.id)) return false
        recipes.add(recipe.id)
        if (node.type !== 'Panel' && node.type !== 'Group' && node.children?.length) return false
        return (node.children ?? []).every((child) => visit(child, depth + 1))
    }
    if (
        !visit(spec.root, 1) ||
        seen.size !== Object.keys(spec.elements).length ||
        spec.elements[spec.root]?.type !== 'Panel'
    )
        return false
    if (!complete) return true
    const required = candidates.filter(
        (node) =>
            node.description.includes('REQUIRED') ||
            ['action', 'schedule', 'results', 'panel'].includes(node.id),
    )
    return required.every((node) => recipes.has(node.id))
}

export type ComposerEvent =
    | { type: 'plan'; plan: ComposerPlan }
    | { type: 'step'; spec: Spec }
    | { type: 'complete'; spec: Spec; fallback: boolean }
    | { type: 'error'; message: string }
