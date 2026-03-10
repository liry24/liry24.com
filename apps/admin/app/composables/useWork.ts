import equal from 'fast-deep-equal'
import type z from 'zod'

import { LazyAdminModalWork } from '#components'

export const useWork = () => {
    const toast = useToast()
    const overlay = useOverlay()

    const modalWork = overlay.create(LazyAdminModalWork)

    const { data: works, refresh: fetchWorks } = useFetch('/api/works', {
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
    const original = shallowRef(works.value)

    const changed = computed(() => !equal(works.value, original.value))

    const categories = computed<string[]>(() =>
        [...new Set(works.value.map((work) => work.category))].filter(
            (category): category is string => !!category
        )
    )

    const submitting = ref(false)

    const createWork = async (state: Partial<Work>) => {
        submitting.value = true

        try {
            await $fetch('/api/works', {
                method: 'POST',
                body: state,
            })

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Work saved successfully',
                color: 'success',
            })

            await fetchWorks()
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

    const updateWork = async (slug: Work['slug'], item: z.infer<typeof worksUpdateSchema>) => {
        try {
            await $fetch(`/api/works/${slug}`, {
                method: 'PATCH',
                body: item,
            })

            await fetchWorks()

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

    const reorderWorks = async () => {
        try {
            await $fetch('/api/works', {
                method: 'PUT',
                body: {
                    works: works.value,
                },
            })

            await fetchWorks()

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

    const deleteWork = async (slug: Work['slug']) => {
        try {
            if (!(await confirm('Are you sure you want to delete this work?'))) return

            await $fetch(`/api/works/${slug}`, {
                method: 'DELETE',
            })

            await fetchWorks()

            toast.add({
                icon: 'mingcute:check-line',
                title: 'Success',
                description: 'Work deleted successfully',
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
        works,
        changed,
        categories,
        fetchWorks,
        createWork,
        updateWork,
        deleteWork,
        reorderWorks,
        submitting,
        modalWork,
    }
}
