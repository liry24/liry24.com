import { expect, test } from 'vitest'

import { adminRedirect, isAdminPath } from '../shared/utils/adminRedirect'

test('only admin locations can resume after Pocket ID sign-in', () => {
    expect(adminRedirect('/admin/works?filter=art%20work#top')).toBe(
        '/admin/works?filter=art%20work#top',
    )
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/ADMIN/works')).toBe(true)
    expect(isAdminPath('/administrator')).toBe(false)
    expect(isAdminPath('/posts/admin')).toBe(false)
    for (const location of [
        undefined,
        ['/admin/works'],
        '/administrator',
        '/admin/%2e%2e/login',
        '/admin/works ',
        '/login',
        '//[invalid',
        '//example.com/admin/works',
        String.raw`/\example.com/admin/works`,
        'https://example.com/admin/works',
    ]) {
        expect(adminRedirect(location)).toBe('/admin')
    }
})
