const reserved = new Set([
    'admin',
    'api',
    'login',
    'arts',
    'works',
    'posts',
    'media',
    'favicon.ico',
    'robots.txt',
    'sitemap.xml',
    'llms.txt',
    'llms-full.txt',
])

export const socialSlug = (value: string) =>
    value.length > 0 &&
    value.length <= 200 &&
    !/[\\/#?\u0000-\u0020]/u.test(value) &&
    !value.startsWith('_') &&
    !['.', '..'].includes(value) &&
    !reserved.has(value.toLowerCase())
