export const entrySlugSuggestion = (label: string) =>
    label
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[\u0300-\u036f]/gu, '')
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-|-$/gu, '')
