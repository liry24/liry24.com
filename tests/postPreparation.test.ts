import type { EntryPrepareContext } from '@liria24/site-admin'
import { expect, test, vi } from 'vitest'

import { prepareEntry } from '../app/utils/prepareEntry'

const context = (overrides: Partial<EntryPrepareContext> = {}): EntryPrepareContext => ({
    model: 'posts',
    locale: 'ja',
    defaultLocale: 'ja',
    entry: undefined,
    operation: 'publish',
    value: { title: 'Original', content: '# Body', publication: { slug: 'auto' } },
    features: { publishing: true, scheduling: true, revisions: true, sortable: false },
    resource: { display: (value) => ({ title: String(value.title ?? '') }) },
    signal: new AbortController().signal,
    ...overrides,
})

test('draft saves skip slug preparation; publish and schedule generate only the missing slug', async () => {
    const generate = vi.fn(async () => ({ slug: 'generated-post' }))
    const draft = context({ operation: 'save' })
    await prepareEntry(draft, generate)
    expect(generate).not.toHaveBeenCalled()
    expect(draft.value.slug).toBeUndefined()
    for (const operation of ['publish', 'schedule'] as const) {
        const candidate = context({ operation })
        await prepareEntry(candidate, generate)
        expect(generate).toHaveBeenLastCalledWith(
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
    const generate = vi.fn(async () => ({ slug: 'unexpected' }))
    const manual = context({ value: { slug: ' manual-url ', publication: { slug: 'manual' } } })
    await prepareEntry(manual, generate)
    expect(manual.value.slug).toBe('manual-url')
    await expect(
        prepareEntry(context({ value: { publication: { slug: 'manual' } } }), generate),
    ).rejects.toThrow('Enter a slug')
    const established = context({
        entry: {
            data: { publication: { publishedSlug: 'original-url' } },
            publishedRevisionId: null,
        } as EntryPrepareContext['entry'],
    })
    await expect(prepareEntry(established, generate)).rejects.toThrow('established slug')
    expect(generate).not.toHaveBeenCalled()
})

test('other models use the label on publication and immediate saves', async () => {
    const generate = vi.fn()
    for (const operation of ['publish', 'save'] as const) {
        const candidate = context({
            model: 'socials',
            operation,
            features: { publishing: false, scheduling: false, revisions: false, sortable: true },
            value: { title: 'Example Content' },
        })
        await prepareEntry(candidate, generate)
        expect(candidate.value.slug).toBe('example-content')
    }
    expect(generate).not.toHaveBeenCalled()
})

test('failed or cancelled generation never changes the candidate', async () => {
    const candidate = context(),
        original = structuredClone(candidate.value)
    await expect(
        prepareEntry(candidate, async () => {
            throw Error('Synthetic failure')
        }),
    ).rejects.toThrow('Synthetic failure')
    expect(candidate.value).toEqual(original)
    const controller = new AbortController()
    await expect(
        prepareEntry({ ...candidate, signal: controller.signal }, async () => {
            controller.abort()
            return { slug: 'cancelled' }
        }),
    ).rejects.toThrow()
    expect(candidate.value).toEqual(original)
})
