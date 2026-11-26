import { isComposing, matchesShortcut } from '@ui-sdk/core'

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

export default function useKeyCommand(callback: () => void) {
    let index = 0

    // A sequence observes each key without taking over its browser action.
    useEventListener(
        'keydown',
        (event) => {
            if (event.repeat) return

            const key = konamiCode[index]
            const target = event
                .composedPath()
                .find(
                    (node): node is Element =>
                        'nodeType' in node && node.nodeType === Node.ELEMENT_NODE,
                )
            const editing =
                target?.matches('input, textarea, select') ||
                (target && 'isContentEditable' in target && target.isContentEditable === true)

            if (
                event.defaultPrevented ||
                isComposing(event) ||
                editing ||
                !key ||
                !matchesShortcut(event, key)
            ) {
                index = 0
                return
            }

            index++
            if (index === konamiCode.length) {
                index = 0
                callback()
            }
        },
        { passive: true },
    )
}
