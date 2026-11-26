export interface AdminCollectionLink {
    name: ContentCollectionName
    label: string
    icon: string
    to: string
}

export interface PortfolioCollectionMeta {
    title: string
    icon: string
    entryLabel: string
    endpoint: string
}

export const portfolioCollectionMeta: Record<PortfolioCollectionName, PortfolioCollectionMeta> = {
    works: {
        title: 'Works',
        icon: 'mingcute:briefcase-fill',
        entryLabel: 'work',
        endpoint: 'work',
    },
    arts: {
        title: 'Arts',
        icon: 'mingcute:palette-fill',
        entryLabel: 'artwork',
        endpoint: 'art',
    },
    careers: {
        title: 'Careers',
        icon: 'mingcute:building-2-fill',
        entryLabel: 'career entry',
        endpoint: 'career',
    },
    skills: {
        title: 'Skills',
        icon: 'mingcute:tool-fill',
        entryLabel: 'skill',
        endpoint: 'skill',
    },
    gameStats: {
        title: 'Game Stats',
        icon: 'mingcute:chart-line-fill',
        entryLabel: 'stat period',
        endpoint: 'game-stats',
    },
    socials: {
        title: 'Socials',
        icon: 'mingcute:link-2-fill',
        entryLabel: 'social link',
        endpoint: 'social',
    },
}

const portfolioCollectionOrder = [
    'works',
    'arts',
    'careers',
    'skills',
    'gameStats',
    'socials',
] as const satisfies ReadonlyArray<PortfolioCollectionName>

export const portfolioCollectionLinks: Array<AdminCollectionLink> = portfolioCollectionOrder.map(
    (name) => ({
        name,
        label: portfolioCollectionMeta[name].title,
        icon: portfolioCollectionMeta[name].icon,
        to: `/admin/${name}`,
    }),
)

export const adminCollectionLinks: Array<AdminCollectionLink> = [
    {
        name: 'posts',
        label: 'Posts',
        icon: 'mingcute:document-2-fill',
        to: '/admin/posts',
    },
    ...portfolioCollectionLinks,
]
