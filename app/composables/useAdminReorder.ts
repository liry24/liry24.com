export const useAdminReorder = (options: {
    model: PortfolioCollectionName | 'games'
    currentOrder: ComputedRef<Array<string>>
    refresh: () => Promise<void>
    focusToggle?: () => void
}) => {
    const toast = useToast()
    const reorderFrom = ref<Array<string> | null>(null)
    const orderDraft = ref<Array<string>>([])
    const savingOrder = ref(false)
    const reorderError = ref('')

    const reordering = computed(() => reorderFrom.value !== null)
    const visibleOrder = computed({
        get: () => (reordering.value ? orderDraft.value : options.currentOrder.value),
        set: (value: Array<string>) => {
            orderDraft.value = value
        },
    })
    const orderChanged = computed(() =>
        Boolean(reorderFrom.value?.some((id, index) => id !== orderDraft.value[index])),
    )

    const beginReorder = () => {
        reorderFrom.value = options.currentOrder.value
        orderDraft.value = options.currentOrder.value
        reorderError.value = ''
    }

    const endReorder = async () => {
        reorderFrom.value = null
        await nextTick()
        options.focusToggle?.()
    }

    const cancelReorder = () => {
        reorderError.value = ''
        void endReorder()
    }

    const saveOrder = async () => {
        const from = reorderFrom.value
        if (!from || !orderChanged.value || savingOrder.value) return

        savingOrder.value = true
        reorderError.value = ''
        let resetOrder = false
        try {
            await $fetch('/api/admin/reorder', {
                method: 'POST',
                body: { model: options.model, from, to: orderDraft.value },
            })
            await options.refresh()
            toast.add({
                title: options.model === 'games' ? 'Saved order' : 'Saved order as draft',
                color: 'success',
            })
            resetOrder = true
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
                await options.refresh()
                resetOrder =
                    options.currentOrder.value.length !== from.length ||
                    options.currentOrder.value.some((id, index) => id !== from[index])
            }
            reorderError.value = adminErrorMessage(error, 'Could not save order.')
        } finally {
            savingOrder.value = false
            if (resetOrder) await endReorder()
        }
    }

    return {
        reordering,
        visibleOrder,
        orderChanged,
        savingOrder,
        reorderError,
        beginReorder,
        cancelReorder,
        saveOrder,
    }
}
