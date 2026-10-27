import type { AnyVueFormApi } from '@tanstack/vue-form'
import type { BlobReference } from '@vite-hub/blob/reference'
import type { MaybeRefOrGetter } from 'vue'

export function useImageUpload(model: string, form: AnyVueFormApi, id: MaybeRefOrGetter<string>) {
    const busy = ref(false),
        error = ref(''),
        request = useRequestFetch(),
        origin = useRequestURL().origin,
        scope = useAdminUserScope()
    async function upload(name: string, files: File | File[] | null | undefined, multiple = false) {
        const selected = Array.isArray(files) ? files : files ? [files] : []
        if (!selected.length || busy.value) return
        const identity = `${scope.value}:${toValue(id)}`
        const path = `data.${name}`,
            parent = name.includes('[') ? path.slice(0, path.lastIndexOf('.')) : path
        const before = JSON.stringify(form.getFieldValue(parent))
        busy.value = true
        error.value = ''
        try {
            const body = new FormData()
            for (const file of selected) body.append('files', file)
            const references = await request<BlobReference[]>('/api/admin/images', {
                method: 'POST',
                query: { model },
                body,
                headers: { origin },
            })
            if (
                identity !== `${scope.value}:${toValue(id)}` ||
                before !== JSON.stringify(form.getFieldValue(parent))
            )
                throw new Error(
                    'The image target changed during upload. Your newer edits were kept.',
                )
            const current = form.getFieldValue(path)
            form.setFieldValue(
                path,
                multiple
                    ? [...(Array.isArray(current) ? current : []), ...references]
                    : references[0],
            )
        } catch (cause) {
            error.value = adminErrorMessage(cause, 'Image upload failed.')
        } finally {
            busy.value = false
        }
    }
    return { upload, busy, error }
}
