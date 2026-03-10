import equal from 'fast-deep-equal'
import type { z } from 'zod'

import { LazyAdminModalArt } from '#components'

export const useArt = () => {
    const toast = useToast()
    const overlay = useOverlay()

    const modalArt = overlay.create(LazyAdminModalArt)

    const { data: arts, refresh: fetchArts } = useFetch('/api/arts', {
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
    const original = shallowRef(arts.value)

    const changed = computed(() => !equal(arts.value, original.value))

    const submitting = ref(false)

    const createArt = async (state: Partial<Art>) => {
        submitting.value = true

        try {
            await $fetch('/api/arts', {
                method: 'POST',
                body: state,
            })

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Art saved successfully',
                color: 'success',
            })

            await fetchArts()
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while saving the art',
                color: 'error',
            })
            throw e
        } finally {
            submitting.value = false
        }
    }

    const updateArt = async (id: Art['slug'], item: z.infer<typeof artsUpdateSchema>) => {
        try {
            await $fetch(`/api/arts/${id}`, {
                method: 'PATCH',
                body: item,
            })

            await fetchArts()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Art saved successfully',
                color: 'success',
            })
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while saving the art',
                color: 'error',
            })
            throw e
        }
    }

    const reorderArts = async () => {
        try {
            await $fetch('/api/arts', {
                method: 'PUT',
                body: {
                    arts: arts.value,
                },
            })

            await fetchArts()

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

    const deleteArt = async (id: Art['slug']) => {
        try {
            if (!(await confirm('Are you sure you want to delete this art?'))) return

            await $fetch(`/api/arts/${id}`, {
                method: 'DELETE',
            })

            await fetchArts()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Art deleted successfully',
                color: 'success',
            })
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while deleting the art',
                color: 'error',
            })
            throw e
        }
    }

    return {
        arts,
        changed,
        fetchArts,
        createArt,
        updateArt,
        deleteArt,
        reorderArts,
        submitting,
        modalArt,
    }
}
