export default (callback: () => void) => {
    const konamiCode = [
        'ArrowUp',
        'ArrowUp',
        'ArrowDown',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'ArrowLeft',
        'ArrowRight',
        'b',
        'a',
    ]

    let index = 0

    const handleKeyDown = (event: KeyboardEvent) => {
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
        const targetKey =
            konamiCode[index]?.length === 1 ? konamiCode[index]?.toLowerCase() : konamiCode[index]

        if (key === targetKey) {
            index++
            if (index === konamiCode.length) {
                callback()
                index = 0
            }
        } else {
            index = 0
        }
    }

    if (import.meta.client) {
        onMounted(() => {
            window.addEventListener('keydown', handleKeyDown)
        })

        onUnmounted(() => {
            window.removeEventListener('keydown', handleKeyDown)
        })
    }
}
