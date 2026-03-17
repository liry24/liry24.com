export default eventHandler(async () => {
    const data = await db.query.skills.findMany({
        orderBy: {
            sortIndex: 'asc',
        },
    })

    return data
})
