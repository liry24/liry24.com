export interface FocusableElement {
    isConnected: boolean
    focus: () => void
}

function isFocusableElement(value: unknown): value is FocusableElement {
    return (
        typeof value === 'object' &&
        value !== null &&
        'isConnected' in value &&
        typeof value.isConnected === 'boolean' &&
        'focus' in value &&
        typeof value.focus === 'function'
    )
}

export function captureActiveFocus(): FocusableElement | null {
    return isFocusableElement(document.activeElement) ? document.activeElement : null
}
