import equal from 'fast-deep-equal'
import type { z } from 'zod'

import { LazyAdminModalSocial } from '#components'

export const useSocial = () => {
    const toast = useToast()
    const overlay = useOverlay()

    const modalSocial = overlay.create(LazyAdminModalSocial)

    const { data: socials, refresh: fetchSocials } = useFetch('/api/socials', {
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
    const original = shallowRef(socials.value)

    const changed = computed(() => !equal(socials.value, original.value))

    const submitting = ref(false)

    const createSocial = async (state: Partial<Social>) => {
        submitting.value = true

        try {
            await $fetch('/api/socials', {
                method: 'POST',
                body: state,
            })

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Work saved successfully',
                color: 'success',
            })

            await fetchSocials()
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while saving the work',
                color: 'error',
            })
            throw e
        } finally {
            submitting.value = false
        }
    }

    const updateSocial = async (id: Social['id'], item: z.infer<typeof socialsUpdateSchema>) => {
        try {
            await $fetch(`/api/socials/${id}`, {
                method: 'PATCH',
                body: item,
            })

            await fetchSocials()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Work saved successfully',
                color: 'success',
            })
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while saving the work',
                color: 'error',
            })
            throw e
        }
    }

    const reorderSocials = async () => {
        try {
            await $fetch('/api/socials', {
                method: 'PUT',
                body: {
                    socials: socials.value,
                },
            })

            await fetchSocials()

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

    const deleteSocial = async (id: Social['id']) => {
        try {
            if (!(await confirm('Are you sure you want to delete this social?'))) return

            await $fetch(`/api/socials/${id}`, {
                method: 'DELETE',
            })

            await fetchSocials()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Social deleted successfully',
                color: 'success',
            })
        } catch (e) {
            console.error(e)
            toast.add({
                icon: 'mingcute:close-line',
                title: 'Error',
                description: 'An error occurred while deleting the work',
                color: 'error',
            })
            throw e
        }
    }

    return {
        socials,
        changed,
        fetchSocials,
        createSocial,
        updateSocial,
        deleteSocial,
        reorderSocials,
        submitting,
        modalSocial,
    }
}
