import { litiFixture } from '@litijs/test-utils/vitest'
import { LitiError, resolveLitiConfig, type ModelPreparationContext } from 'liti'
import { expect, test as base, vi } from 'vitest'

import config from '../liti.config'

const actor = { id: 'test-admin', roles: ['admin'] }
const test = base.extend({
    liti: litiFixture(config, {
        authenticate: () => actor,
        locales: { defaultLocale: 'ja', supported: ['ja', 'en'] },
    }),
})

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
    read: {
        published: { routeAvailable: vi.fn(async () => true) },
    } as unknown as ModelPreparationContext['read'],
    executeAction: vi.fn(async () => ({ data: { slug: 'generated-post' } })),
})

test('configured models prepare slugs through the service and retain established URLs', async ({
    liti,
}) => {
    const service = await liti.service({ actor })
    const candidate = await service.createEntry('socials', {
        data: {
            label: 'Example Content',
            href: 'https://example.invalid',
            icon: 'mingcute:link-fill',
        },
    })
    expect((await liti.client.getEntry(candidate.id)).data.slug).toBe('example-content')
    const manual = await service.createEntry('socials', {
        data: {
            label: 'Ignored',
            slug: ' manual-url ',
            href: 'https://example.invalid',
            icon: 'mingcute:link-fill',
        },
    })
    expect((await liti.client.getEntry(manual.id)).data.slug).toBe('manual-url')
    await expect(
        service.updateEntry(candidate.id, {
            expectedVersion: candidate.version,
            data: { slug: '' },
        }),
    ).rejects.toMatchObject({
        code: 'LITI_INVALID_INPUT',
        issues: [{ path: 'slug', message: 'An established slug cannot be empty.' }],
    })
    expect((await liti.client.getEntry(candidate.id)).data.slug).toBe('example-content')
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

test('the configured post model publishes with a unique fallback slug after AI failure', async () => {
    const posts = resolveLitiConfig(config, []).models.posts
    const candidate = context({
        title: 'これはexample title',
        content: '# Original',
        slug: '',
        publication: { slug: 'auto' },
    })
    vi.mocked(candidate.executeAction).mockRejectedValueOnce(
        new LitiError('LITI_ACTION_FAILED', 'Unavailable'),
    )
    vi.mocked(candidate.read.published.routeAvailable)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
    await posts.preparePublication?.(candidate)
    expect(candidate.data).toMatchObject({
        title: 'これはexample title',
        content: '# Original',
        slug: expect.stringMatching(/^example-title-[a-z0-9]{6}$/),
    })
})
