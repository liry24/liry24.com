import type { EntryPrepareContext } from '@liria24/site-admin'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeAll, beforeEach, expect, test, vi } from 'vitest'

import { useNuxtApp } from '#app'

import plugin from '../../app/plugins/entry-prepare'

const { run } = vi.hoisted(() => ({ run: vi.fn() }))
mockNuxtImport('useAdminClient', () => () => ({ ai: { run } }))
let app: ReturnType<typeof useNuxtApp>
beforeAll(() => {
    app = useNuxtApp()
    app.runWithContext(() => plugin(app))
})
const prepare = (context: EntryPrepareContext) => app.callHook('site-admin:entry:prepare', context)
beforeEach(() => run.mockReset())

const context = (overrides: Partial<EntryPrepareContext> = {}): EntryPrepareContext => ({
    model: 'posts',
    locale: 'ja',
    defaultLocale: 'ja',
    entry: undefined,
    operation: 'publish',
    value: { title: 'Original', content: '# Body', publication: { slug: 'auto' } },
    features: { publishing: true, scheduling: true, revisions: true, sortable: false },
    resource: {
        display: (value) => ({
            title: String(value.title ?? ''),
            description: '',
            image: undefined,
        }),
    },
    signal: new AbortController().signal,
    ...overrides,
})

test('draft saves skip slug preparation; publish and schedule generate only the missing slug', async () => {
    run.mockResolvedValue({ slug: 'generated-post' })
    const draft = context({ operation: 'save' })
    await prepare(draft)
    expect(run).not.toHaveBeenCalled()
    expect(draft.value.slug).toBeUndefined()
    for (const operation of ['publish', 'schedule'] as const) {
        const candidate = context({ operation })
        await prepare(candidate)
        expect(run).toHaveBeenLastCalledWith(
            'publication',
            { title: 'Original', content: '# Body' },
            { signal: candidate.signal },
        )
        expect(candidate.value).toMatchObject({
            slug: 'generated-post',
            title: 'Original',
            content: '# Body',
            publication: { publishedSlug: 'generated-post' },
        })
    }
})

test('manual slugs win and established URLs cannot be emptied after unpublishing', async () => {
    run.mockResolvedValue({ slug: 'unexpected' })
    const manual = context({ value: { slug: ' manual-url ', publication: { slug: 'manual' } } })
    await prepare(manual)
    expect(manual.value.slug).toBe('manual-url')
    await expect(prepare(context({ value: { publication: { slug: 'manual' } } }))).rejects.toThrow(
        'Enter a slug',
    )
    const established = context({
        entry: {
            data: { publication: { publishedSlug: 'original-url' } },
            publishedRevisionId: null,
        } as unknown as EntryPrepareContext['entry'],
    })
    await expect(prepare(established)).rejects.toThrow('established slug')
    expect(run).not.toHaveBeenCalled()
})

test('other models use the label on publication and immediate saves', async () => {
    for (const operation of ['publish', 'save'] as const) {
        const candidate = context({
            model: 'socials',
            operation,
            features: { publishing: false, scheduling: false, revisions: false, sortable: true },
            value: { title: 'Example Content' },
        })
        await prepare(candidate)
        expect(candidate.value.slug).toBe('example-content')
    }
    expect(run).not.toHaveBeenCalled()
})

test('failed or cancelled generation never changes the candidate', async () => {
    const candidate = context(),
        original = structuredClone(candidate.value)
    run.mockRejectedValueOnce(Error('Synthetic failure'))
    await expect(prepare(candidate)).rejects.toThrow('Synthetic failure')
    expect(candidate.value).toEqual(original)
    const controller = new AbortController()
    run.mockImplementationOnce(async () => {
        controller.abort()
        return { slug: 'cancelled' }
    })
    await expect(prepare({ ...candidate, signal: controller.signal })).rejects.toThrow()
    expect(candidate.value).toEqual(original)
})
