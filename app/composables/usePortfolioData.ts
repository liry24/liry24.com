export function usePortfolioData<Name extends PortfolioCollectionName>(model: Name) {
    const request = useRequestFetch()
    return useAsyncData<Array<PortfolioItem<Name>>>(
        `portfolio:${model}`,
        async (_app, { signal }) => {
            const response = await request<{ items: Array<PortfolioItem<Name>> }>(
                `/api/portfolio/${model}`,
                { signal },
            )
            return response.items
        },
    )
}
