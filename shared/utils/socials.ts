const reserved = new Set([
    'admin',
    'api',
    'login',
    'arts',
    'works',
    'posts',
    'media',
    'avatar.png',
    'avatar.jpg',
    'avatar.jpeg',
    'avatar.webp',
    'favicon.ico',
    'robots.txt',
    'sitemap.xml',
    'llms.txt',
    'llms-full.txt',
])

const hasControlOrWhitespace = (value: string): boolean => {
    for (const char of value) if ((char.codePointAt(0) ?? 0) <= 0x20) return true

    return false
}

export const socialSlug = (value: string) =>
    value.length > 0 &&
    value.length <= 200 &&
    !hasControlOrWhitespace(value) &&
    !/[\\/#?]/u.test(value) &&
    !value.startsWith('_') &&
    !['.', '..'].includes(value) &&
    !reserved.has(value.toLowerCase())
