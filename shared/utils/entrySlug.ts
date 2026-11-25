export const entrySlugSuggestion = (label: string) =>
    label
        .normalize('NFKD')
        .toLowerCase()
        .replaceAll(/[\u0300-\u036f]/gu, '')
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .replaceAll(/^-|-$/gu, '')
