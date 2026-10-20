import { resolveLitiConfig, type ModelPreparationContext } from 'liti'
import { expect, test, vi } from 'vitest'

import config from '../liti.config'
import { prepareEntrySlug } from '../server/utils/entryPreparation'

const context = (
    data: Record<string, unknown>,
    previous?: ModelPreparationContext['previous'],
): ModelPreparationContext => ({
    model: 'posts',
    entryId: 'test',
    locale: 'ja',
    defaultLocale: 'ja',
    operation: 'publish',
    data,
    previous,
    issues: [],
    read: {} as ModelPreparationContext['read'],
    executeAction: vi.fn(async () => ({ data: { slug: 'generated-post' } })),
})

test('app labels prepare non-blog slugs and retain established URLs', () => {
    const prepare = prepareEntrySlug('label')
    const candidate = context({ label: 'Example Content' })
    prepare(candidate)
    expect(candidate.data.slug).toBe('example-content')
    const manual = context({ label: 'Ignored', slug: ' manual-url ' })
    prepare(manual)
    expect(manual.data.slug).toBe('manual-url')
    const established = context({ label: 'Do not replace' }, {
        firstPublishedAt: '2026-10-01',
    } as ModelPreparationContext['previous'])
    prepare(established)
    expect(established.data.slug).toBeUndefined()
    expect(established.issues[0]?.message).toContain('established slug')
})

test('the app blog model uses shared publication generation and preserves title/content', async () => {
    const posts = resolveLitiConfig(config, []).models.posts
    const candidate = context({
        title: 'Original',
        content: '# Body',
        publication: { slug: 'auto' },
        slug: '',
    })
    await posts.preparePublication?.(candidate)
    expect(candidate.executeAction).toHaveBeenCalledExactlyOnceWith('publication', {
        title: 'Original',
        context: '# Body',
    })
    expect(candidate.data).toEqual({
        title: 'Original',
        content: '# Body',
        publication: { slug: 'auto' },
        slug: 'generated-post',
    })
    expect(posts.editor?.blog).toMatchObject({ proofreading: 'proofread', guard: 'pending' })
})
