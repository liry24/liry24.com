export default eventHandler(async () => {
    const data = await db.query.careers.findMany({
        orderBy: {
            sortIndex: 'asc',
        },
    })

    return data
})
