export const useAdminContentActions = (
    collection: ContentCollectionName,
    refresh: () => Promise<void>,
    noun = 'item',
) => {
    const toast = useToast()
    const busyId = ref<string | null>(null)

    const publishDocument = async (id: string, digest?: string | null) => {
        busyId.value = id
        try {
            await $fetch('/api/admin/content/publish', {
                method: 'POST',
                body: {
                    action: 'publish',
                    collection,
                    id,
                    digest: digest ?? null,
                },
            })
            toast.add({ title: `Published ${noun}`, color: 'success' })
            await refresh()
        } catch (error) {
            toast.add({
                title: 'Publish failed',
                description: adminErrorMessage(error, `Could not publish ${noun}.`),
                color: 'error',
            })
        } finally {
            busyId.value = null
        }
    }

    const deleteDocument = async (id: string) => {
        busyId.value = id
        try {
            await $fetch(`/api/admin/content/${collection}/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                query: { publish: 'true' },
            })
            toast.add({ title: `Deleted ${noun}`, color: 'neutral' })
            await refresh()
        } catch (error) {
            toast.add({
                title: 'Delete failed',
                description: adminErrorMessage(error, `Could not delete ${noun}.`),
                color: 'error',
            })
        } finally {
            busyId.value = null
        }
    }

    const scheduleDocument = async (id: string, at: string, digest?: string | null) => {
        busyId.value = id
        try {
            await $fetch('/api/admin/content/publish', {
                method: 'POST',
                body: {
                    action: 'schedule',
                    collection,
                    id,
                    digest: digest ?? null,
                    at,
                },
            })
            toast.add({ title: 'Scheduled publish', color: 'success' })
            await refresh()
            return true
        } catch (error) {
            toast.add({
                title: 'Schedule failed',
                description: adminErrorMessage(error, `Could not schedule ${noun}.`),
                color: 'error',
            })
            return false
        } finally {
            busyId.value = null
        }
    }

    const unscheduleDocument = async (scheduleId: string, itemId: string) => {
        busyId.value = itemId
        try {
            await $fetch('/api/admin/content/publish', {
                method: 'POST',
                body: {
                    action: 'unschedule',
                    scheduleId,
                },
            })
            toast.add({ title: 'Cancelled schedule', color: 'neutral' })
            await refresh()
            return true
        } catch (error) {
            toast.add({
                title: 'Unschedule failed',
                description: adminErrorMessage(error, 'Could not cancel schedule.'),
                color: 'error',
            })
            return false
        } finally {
            busyId.value = null
        }
    }

    return {
        busyId,
        publishDocument,
        deleteDocument,
        scheduleDocument,
        unscheduleDocument,
    }
}
