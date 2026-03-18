export default eventHandler(async () => {
    const data = await db.query.ranks.findMany({
        orderBy: {
            sortIndex: 'asc',
        },
    })

    return data
})
