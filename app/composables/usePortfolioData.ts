type PortfolioModel = Exclude<PortfolioCollectionName, 'gameStats'>

type PortfolioDataGuards = {
    [K in PortfolioModel]: (data: CollectionDocumentData) => data is PortfolioItem<K>['data']
}

const portfolioDataGuards: PortfolioDataGuards = {
    works: (data): data is WorkData => 'style' in data,
    arts: (data): data is ArtData => 'images' in data,
    careers: (data): data is CareerData => 'company' in data,
    skills: (data): data is SkillData => 'name' in data,
    socials: (data): data is SocialData => 'label' in data,
}

export const usePortfolioData = <Name extends PortfolioModel>(model: Name) => {
    const request = useRequestFetch()
    const path: `/api/portfolio/${PortfolioModel}` = `/api/portfolio/${model}`

    return useAsyncData(`portfolio:${model}`, async (_app, { signal }) => {
        const response = await request(path, { signal })
        const isModelData = portfolioDataGuards[model]
        return response.items.flatMap((item) =>
            isModelData(item.data) ? [{ id: item.id, data: item.data }] : [],
        )
    })
}
