export type AdminMediaFolder = 'posts' | 'works' | 'arts' | 'games' | 'uploads'

export const useAdminMediaUpload = (folder: MaybeRefOrGetter<AdminMediaFolder>) => {
    const uploading = ref(false)

    const uploadImage = async (file: File): Promise<MediaReference> => {
        const body = new FormData()
        body.append('file', file)
        body.append('folder', toValue(folder))
        return await $fetch<MediaReference>('/api/admin/media', {
            method: 'POST',
            body,
        })
    }

    const uploadSingle = async (
        file: File,
        options?: { successTitle?: string; fallbackError?: string },
    ): Promise<MediaReference | undefined> => {
        if (uploading.value) return undefined
        const toast = useToast()
        uploading.value = true
        try {
            const media = await uploadImage(file)
            if (options?.successTitle) toast.add({ title: options.successTitle, color: 'success' })
            return media
        } catch (error) {
            toast.add({
                title: 'Upload failed',
                description: adminErrorMessage(
                    error,
                    options?.fallbackError ?? 'Could not upload image.',
                ),
                color: 'error',
            })
            return undefined
        } finally {
            uploading.value = false
        }
    }

    return {
        uploading,
        uploadImage,
        uploadSingle,
    }
}
