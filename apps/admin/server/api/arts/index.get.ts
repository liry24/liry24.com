export default eventHandler(async () => {
    const data = await db.query.arts.findMany({
        orderBy: {
            sortIndex: 'asc',
            createdAt: 'asc',
        },
        with: {
            images: {
                columns: {
                    src: true,
                    alt: true,
                },
            },
        },
    })

    return data
})
