<script setup lang="ts">
import { UiField, UiImagePicker } from '@liry24/ui'

const model = defineModel<Array<MediaReference>>({ required: true })
const props = defineProps<{
    label: string
    folder: AdminMediaFolder
    error?: string
    required?: boolean
    multiple?: boolean
    disabled?: boolean
}>()
const emit = defineEmits<{ busy: [busy: boolean] }>()
const { uploadImage } = useAdminMediaUpload(() => props.folder)
const uploading = ref(false)
const uploadError = ref('')
const selectionError = ref('')
const previews = computed(() => {
    const occurrences = new Map<string, number>()
    return model.value.map((image, index) => {
        const occurrence = occurrences.get(image.pathname) ?? 0
        occurrences.set(image.pathname, occurrence + 1)
        return {
            id: `${image.pathname}:${occurrence}`,
            src: mediaUrl(image),
            label: `${props.label} ${index + 1}`,
        }
    })
})

async function upload(files: Array<File>) {
    if (uploading.value || props.disabled) return
    uploading.value = true
    uploadError.value = ''
    selectionError.value = ''
    emit('busy', true)
    const images: Array<MediaReference> = []
    const errors: Array<string> = []
    let next = 0
    async function uploadNext() {
        while (next < files.length) {
            const index = next++
            const file = files[index]
            if (!file) continue

            try {
                images[index] = await uploadImage(file)
            } catch (error) {
                errors[index] = `${file.name} (${adminErrorMessage(error, 'upload failed')})`
            }
        }
    }
    try {
        await Promise.all(Array.from({ length: Math.min(files.length, 3) }, uploadNext))
        const uploaded = images.filter(Boolean)
        const lastImage = uploaded.at(-1)
        if (lastImage) model.value = props.multiple ? [...model.value, ...uploaded] : [lastImage]

        const failed = errors.filter(Boolean)
        if (failed.length)
            uploadError.value = `Could not upload ${failed.join(', ')}. Choose the failed files again to retry.`
    } finally {
        uploading.value = false
        emit('busy', false)
    }
}

function move(from: number, to: number) {
    const next = [...model.value]
    const [image] = next.splice(from, 1)
    if (!image) return
    next.splice(to, 0, image)
    model.value = next
}
</script>

<template>
    <UiField :label="label" :required="required" :error="error">
        <UiImagePicker
            :label="label"
            :images="previews"
            :multiple="multiple"
            :disabled="disabled"
            :busy="uploading"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            :max-size="10 * 1024 * 1024"
            @files="upload"
            @reject="
                selectionError = `${$event.map((file) => file.name).join(', ')}: choose a PNG, JPEG, WebP, AVIF, or GIF up to 10 MB.`
            "
            @remove="(index) => (model = model.filter((_, itemIndex) => itemIndex !== index))"
            @move="move"
        />
        <p v-if="selectionError" class="ui-error" role="alert">{{ selectionError }}</p>
        <p v-if="uploadError" class="ui-error" role="alert">{{ uploadError }}</p>
    </UiField>
</template>
