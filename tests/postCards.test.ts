import type { ElementNodeAttributes, Node } from 'comark'
import { parseMarkdown } from 'comark/parse'
import { expect, test } from 'vitest'

import { postCards } from '../server/utils/postCards'
import type { PostItem } from '../shared/types/content'
import { postMarkdownSecurity } from '../shared/utils/postMarkdown'

const literalCode = '<script>Code example remains text</script>'

const content = [
    'An **introduction** with [a safe link](/works).',
    '<script>globalThis.auditMarker = 1</script>',
    '<iframe src="https://example.invalid" srcdoc="<script>marker</script>"></iframe>',
    '<meta http-equiv="refresh" content="0;url=https://example.invalid">',
    '<base href="https://example.invalid">',
    '<style>body { display: none }</style>',
    '<svg onload="marker()"></svg>',
    '<img src="/safe.png" onerror="marker()">',
    '<img src="data:image/svg+xml,marker">',
    '<a href="java&#x73;cript:marker()" onclick="marker()">Unsafe link</a>',
    '::admin-form-post-editor\n::',
    ':u-button[Component button]',
    '<span as="AdminFormPostEditor">Component override</span>',
    '<a to="javascript:globalThis.auditMarker=1">Component link prop</a>',
    `<a :as='"script"'>globalThis.auditMarker=1</a>`,
    `<pre :copy='{"as":"script","label":"globalThis.auditMarker=1"}'>Safe code</pre>`,
    `<a :href='"javascript:globalThis.auditMarker=1"'>Bound unsafe link</a>`,
    '<img :src="frontmatter.image">',
    '<a href="https://example.invalid" target="_blank" rel="noopener">External link</a>',
    '<img src="/wide.png" alt="Safe image" width="100" height="50">',
    '<details open><summary title="More">Open details</summary>Body</details>',
    '| Heading | Other |\n| :--- | ---: |\n| Cell | Cell |',
    '3. Ordered item',
    '```ts [example.ts] {1}\nconst retained = true\n```',
    '<details><summary>Safe details</summary>Safe body</details>',
    '- [x] Completed task\n- [ ] Pending task',
    '<!-- more -->',
    'Full body **retained**.',
    ['```html', literalCode, '```'].join('\n'),
].join('\n\n')

function assertSafe(nodes: Array<Node>) {
    const elements: Array<{ tag: string; props: ElementNodeAttributes }> = []
    const visit = (list: Array<Node>) => {
        for (const node of list) {
            if (typeof node === 'string' || node[0] === null) continue

            const [tag, props, ...children] = node
            if (tag) elements.push({ tag, props })

            visit(children)
        }
    }
    visit(nodes)
    for (const { tag, props } of elements) {
        expect([
            'script',
            'iframe',
            'meta',
            'base',
            'style',
            'svg',
            'admin-form-post-editor',
            'u-button',
        ]).not.toContain(tag.toLowerCase())
        for (const [name, value] of Object.entries(props)) {
            expect(name).not.toMatch(/^(on|@|v-on:)|srcdoc|innerhtml/i)
            if (['href', 'src'].includes(name))
                expect(String(value)).not.toMatch(/javascript|data:/i)
        }
        for (const name of ['as', ':as', 'to', ':to', 'copy', ':copy', ':href', ':src'])
            expect(props).not.toHaveProperty(name)
    }
    expect(elements.some((el) => el.tag === 'a' && el.props.href === '/works')).toBe(true)
    expect(elements.some((el) => el.tag === 'img' && el.props.src === '/safe.png')).toBe(true)
    expect(elements.some(({ tag }) => tag === 'details')).toBe(true)
    expect(elements.some(({ tag }) => tag === 'strong')).toBe(true)
    expect(
        elements.some(
            (el) =>
                el.tag === 'a' &&
                el.props.href === 'https://example.invalid' &&
                el.props.target === '_blank' &&
                el.props.rel === 'noopener',
        ),
    ).toBe(true)
    expect(
        elements.some(
            (el) =>
                el.tag === 'img' &&
                el.props.src === '/wide.png' &&
                el.props.alt === 'Safe image' &&
                el.props.width === '100' &&
                el.props.height === '50',
        ),
    ).toBe(true)
    expect(elements.some(({ tag }) => tag === 'table')).toBe(true)
    expect(elements.some((el) => el.tag === 'td' && el.props.style === 'text-align:right')).toBe(
        true,
    )
    expect(elements.some((el) => el.tag === 'details' && el.props.open === true)).toBe(true)
    expect(elements.some((el) => el.tag === 'ol' && el.props.start === '3')).toBe(true)
    expect(
        elements.some(
            (el) =>
                el.tag === 'pre' &&
                el.props.language === 'ts' &&
                el.props.filename === 'example.ts' &&
                Array.isArray(el.props.highlights) &&
                el.props.highlights[0] === 1,
        ),
    ).toBe(true)
    expect(
        elements.some(
            (el) =>
                el.tag === 'input' &&
                el.props.type === 'checkbox' &&
                el.props[':disabled'] === 'true',
        ),
    ).toBe(true)
}

const entry = (body: string): PostItem => ({
    id: 'synthetic-post',
    url: '/posts/synthetic',
    publishedAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-02T00:00:00Z',
    data: {
        title: 'Title',
        plainTitle: 'Title',
        slug: 'synthetic',
        tags: [],
        gameMentions: [],
        order: 0,
    },
    body,
})

test('post cards use the first paragraph if there is no summary delimiter', async () => {
    const [card] = await postCards([entry('Introduction\n\nFull article')])
    expect(card?.excerpt.nodes).toEqual([['p', {}, 'Introduction']])
})

test('the Markdown security policy applies to the full article and the published excerpt', async () => {
    const preview = await parseMarkdown(content, { plugins: [postMarkdownSecurity] })
    const [card] = await postCards([entry(content)])
    assertSafe(preview.nodes)
    assertSafe(card?.excerpt.nodes ?? [])
    expect(preview.nodes).toContainEqual([
        'pre',
        expect.objectContaining({ language: 'html' }),
        ['code', expect.anything(), literalCode],
    ])
    const delimiter = preview.nodes.findIndex((node) => Array.isArray(node) && node[0] === null)
    expect(delimiter).toBeGreaterThan(0)
    expect(card?.excerpt.nodes).toEqual(preview.nodes.slice(0, delimiter))
})

test('explicit card summaries use the same component and HTML security policy', async () => {
    const post = entry('FULL_BODY_SENTINEL')
    post.data.summary =
        'Introduction :game-mention{slug="valorant" :as="script" onclick="bad()"} <a href="javascript:bad()">link</a>'
    const [card] = await postCards([post])
    expect(card?.excerpt.nodes).toEqual([
        [
            'p',
            {},
            'Introduction ',
            ['game-mention', { slug: 'valorant' }, 'valorant'],
            ' ',
            ['a', {}, 'link'],
        ],
    ])
})
