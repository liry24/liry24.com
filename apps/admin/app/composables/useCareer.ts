import equal from 'fast-deep-equal'
import type { z } from 'zod'

import { LazyAdminModalCareer } from '#components'

export const useCareer = () => {
    const toast = useToast()
    const overlay = useOverlay()

    const modalCareer = overlay.create(LazyAdminModalCareer)

    const { data: careers, refresh: fetchCareers } = useFetch('/api/careers', {
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
    const original = shallowRef(careers.value)

    const changed = computed(() => !equal(careers.value, original.value))

    const submitting = ref(false)

    const createCareer = async (state: Partial<Career>) => {
        submitting.value = true

        try {
            await $fetch('/api/careers', {
                method: 'POST',
                body: state,
            })

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Career saved successfully',
                color: 'success',
            })

            await fetchCareers()
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while saving the career',
                color: 'error',
            })
            throw e
        } finally {
            submitting.value = false
        }
    }

    const updateCareer = async (id: Career['id'], item: z.infer<typeof careersUpdateSchema>) => {
        try {
            await $fetch(`/api/careers/${id}`, {
                method: 'PATCH',
                body: item,
            })

            await fetchCareers()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Career saved successfully',
                color: 'success',
            })
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while saving the career',
                color: 'error',
            })
            throw e
        }
    }

    const reorderCareers = async () => {
        try {
            await $fetch('/api/careers', {
                method: 'PUT',
                body: {
                    careers: careers.value,
                },
            })

            await fetchCareers()

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

    const deleteCareer = async (id: Career['id']) => {
        try {
            if (!(await confirm('Are you sure you want to delete this career?'))) return

            await $fetch(`/api/careers/${id}`, {
                method: 'DELETE',
            })

            await fetchCareers()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Career deleted successfully',
                color: 'success',
            })
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while deleting the career',
                color: 'error',
            })
            throw e
        }
    }

    return {
        careers,
        changed,
        fetchCareers,
        createCareer,
        updateCareer,
        deleteCareer,
        reorderCareers,
        submitting,
        modalCareer,
    }
}
