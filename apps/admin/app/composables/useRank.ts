import equal from 'fast-deep-equal'
import type z from 'zod'

import { LazyAdminModalRank } from '#components'

export const useRank = () => {
    const toast = useToast()
    const overlay = useOverlay()

    const modalRank = overlay.create(LazyAdminModalRank)

    const { data: ranks, refresh: fetchRanks } = useFetch('/api/ranks', {
        dedupe: 'defer',
        default: () => [],
        getCachedData: (key, n, ctx) =>
            ctx.cause !== 'refresh:manual' && n.isHydrating
                ? n.payload.data[key]
                : n.static.data[key],
        onResponse: (value) => {
            original.value = value.response._data || []
        },
    })
    const original = shallowRef(ranks.value)

    const changed = computed(() => !equal(ranks.value, original.value))

    const submitting = ref(false)

    const createRank = async (state: Partial<Rank>) => {
        submitting.value = true

        try {
            await $fetch('/api/ranks', {
                method: 'POST',
                body: state,
            })

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Rank saved successfully',
                color: 'success',
            })

            await fetchRanks()
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while saving the rank',
                color: 'error',
            })
            throw e
        } finally {
            submitting.value = false
        }
    }

    const updateRank = async (id: Rank['id'], item: z.infer<typeof ranksUpdateSchema>) => {
        try {
            await $fetch(`/api/ranks/${id}`, {
                method: 'PATCH',
                body: item,
            })

            await fetchRanks()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Rank saved successfully',
                color: 'success',
            })
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while saving the rank',
                color: 'error',
            })
            throw e
        }
    }

    const reorderRanks = async () => {
        try {
            await $fetch('/api/ranks', {
                method: 'PUT',
                body: {
                    ranks: ranks.value,
                },
            })

            await fetchRanks()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Saved',
                description: 'Your changes have been saved',
                color: 'success',
            })
        } catch {
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'Failed to save changes',
                color: 'error',
            })
        }
    }

    const deleteRank = async (id: Rank['id']) => {
        try {
            if (!(await confirm('Are you sure you want to delete this rank?'))) return

            await $fetch(`/api/ranks/${id}`, {
                method: 'DELETE',
            })

            await fetchRanks()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Rank deleted successfully',
                color: 'success',
            })
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while deleting the rank',
                color: 'error',
            })
            throw e
        }
    }

    return {
        ranks,
        changed,
        fetchRanks,
        createRank,
        updateRank,
        deleteRank,
        reorderRanks,
        submitting,
        modalRank,
    }
}
