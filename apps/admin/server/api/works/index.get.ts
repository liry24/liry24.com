export default eventHandler(async () => {
    const data = await db.query.works.findMany({
        orderBy: {
            sortIndex: 'asc',
            createdAt: 'asc',
        },
    })

    return data
})
