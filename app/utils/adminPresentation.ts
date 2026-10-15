export const adminModels = {
    works: {
        label: 'Works',
        entryLabel: 'Work',
        icon: 'mingcute:package-2-fill',
        fields: ['slug', 'category', 'description', 'price', 'href', 'style'],
    },
    arts: { label: 'Arts', entryLabel: 'Art', icon: 'mingcute:pic-fill', fields: ['slug', 'href'] },
    careers: {
        label: 'Careers',
        entryLabel: 'Career',
        icon: 'mingcute:suitcase-fill',
        fields: ['period', 'position'],
    },
    skills: {
        label: 'Skills',
        entryLabel: 'Skill',
        icon: 'mingcute:award-fill',
        fields: ['category'],
    },
    ranks: {
        label: 'Ranks',
        entryLabel: 'Rank',
        icon: 'mingcute:chess-fill',
        fields: ['season', 'rank'],
    },
    socials: {
        label: 'Socials',
        entryLabel: 'Social',
        icon: 'mingcute:link-fill',
        fields: ['href'],
    },
    posts: {
        label: 'Posts',
        entryLabel: 'Post',
        icon: 'mingcute:book-3-fill',
        fields: ['slug'],
    },
} satisfies Record<string, { label: string; entryLabel: string; icon: string; fields: string[] }>

export function adminAssetId(value: unknown): string | undefined {
    if (Array.isArray(value)) value = value[0]
    const id =
        typeof value === 'string'
            ? value
            : value && typeof value === 'object' && 'id' in value
              ? value.id
              : undefined
    return typeof id === 'string' && id ? id : undefined
}
