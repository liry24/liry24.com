import type { Node } from 'comark'
import { expect } from 'vitest'
export const content = [
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
    '```html\n<script>Code example remains text</script>\n```',
].join('\n\n')

export function assertSafe(nodes: Node[]) {
    const elements: Array<{ tag: string; props: Record<string, unknown> }> = []
    const visit = (nodes: Node[]) => {
        for (const node of nodes) {
            if (typeof node === 'string') continue
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
    expect(elements).toContainEqual({
        tag: 'a',
        props: expect.objectContaining({ href: '/works' }),
    })
    expect(elements).toContainEqual({
        tag: 'img',
        props: expect.objectContaining({ src: '/safe.png' }),
    })
    expect(elements.some(({ tag }) => tag === 'details')).toBe(true)
    expect(elements.some(({ tag }) => tag === 'strong')).toBe(true)
    expect(elements).toContainEqual({
        tag: 'a',
        props: expect.objectContaining({
            href: 'https://example.invalid',
            target: '_blank',
            rel: 'noopener',
        }),
    })
    expect(elements).toContainEqual({
        tag: 'img',
        props: expect.objectContaining({
            src: '/wide.png',
            alt: 'Safe image',
            width: '100',
            height: '50',
        }),
    })
    expect(elements.some(({ tag }) => tag === 'table')).toBe(true)
    expect(elements).toContainEqual({
        tag: 'td',
        props: expect.objectContaining({ style: 'text-align:right' }),
    })
    expect(elements).toContainEqual({
        tag: 'details',
        props: expect.objectContaining({ open: true }),
    })
    expect(elements).toContainEqual({ tag: 'ol', props: expect.objectContaining({ start: '3' }) })
    expect(elements).toContainEqual({
        tag: 'pre',
        props: expect.objectContaining({ language: 'ts', filename: 'example.ts', highlights: [1] }),
    })
    expect(elements).toContainEqual({
        tag: 'input',
        props: expect.objectContaining({ type: 'checkbox', ':disabled': 'true' }),
    })
}
