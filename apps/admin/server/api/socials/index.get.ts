export default eventHandler(async () => {
    const data = await db.query.socials.findMany({
        orderBy: {
            sortIndex: 'asc',
        },
    })

    return data
})
