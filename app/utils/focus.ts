export interface FocusableElement {
    isConnected: boolean
    focus: () => void
}

export const isFocusableElement = (value: unknown): value is FocusableElement =>
    typeof value === 'object' &&
    value !== null &&
    'isConnected' in value &&
    typeof value.isConnected === 'boolean' &&
    'focus' in value &&
    typeof value.focus === 'function'

export const captureActiveFocus = (): FocusableElement | null =>
    isFocusableElement(document.activeElement) ? document.activeElement : null
