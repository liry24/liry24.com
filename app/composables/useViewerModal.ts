export const useViewerModal = (open: Ref<boolean>) => {
    const historyStateAdded = ref(false)
    let returnFocus: FocusableElement | null = null

    const restoreFocus = (event: Event) => {
        if (returnFocus?.isConnected) {
            event.preventDefault()
            returnFocus.focus()
        }
    }

    const onPopState = () => {
        if (open.value) {
            historyStateAdded.value = false
            open.value = false
        }
    }

    watch(
        open,
        (val) => {
            if (!import.meta.client) return

            if (val) {
                returnFocus = captureActiveFocus()
                history.pushState(null, '')
                historyStateAdded.value = true
                window.addEventListener('popstate', onPopState)
            } else {
                window.removeEventListener('popstate', onPopState)
                if (historyStateAdded.value) {
                    history.back()
                    historyStateAdded.value = false
                }
            }
        },
        { immediate: true },
    )

    onUnmounted(() => {
        if (import.meta.client) window.removeEventListener('popstate', onPopState)
    })

    return { restoreFocus }
}
