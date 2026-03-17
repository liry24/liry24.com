<script setup lang="ts" generic="M extends boolean = false">
import type { FileUploadProps } from '@nuxt/ui'
import { upload } from '@tigrisdata/storage/client'
import { nanoid } from 'nanoid'
import { joinURL, parseURL } from 'ufo'

const config = useRuntimeConfig()

interface Props extends FileUploadProps<M> {
    prefix?: string
}
const props = withDefaults(defineProps<Props>(), {
    interactive: true,
    prefix: undefined,
})

interface Image {
    src: string
    alt?: string | null
}

// Simplified model type
const model = defineModel<M extends true ? Image[] : Image | null>()

const files = shallowRef<(M extends true ? File[] : File) | null | undefined>()

const uploading = ref<{
    state: boolean
    progress: number
    logs: ConsoleLog[]
}>({
    state: false,
    progress: 0,
    logs: [],
})

const addLog = (message: string, type: ConsoleLog['type'] = 'log') => {
    uploading.value.logs.push({
        createdAt: new Date(),
        message,
        type,
    })
}

const createCleanURL = (url: string) => {
    const parsed = parseURL(url)
    return `${parsed.protocol || ''}//${joinURL(parsed.host || '', parsed.pathname)}`
}

const handleUpload = async (file: File, options: { name: string; totalSteps: number }) => {
    const result = await upload(options.name, file, {
        access: 'public',
        url: '/api/upload',
        onUploadProgress: (progress) => {
            const currentFileProgress = progress.percentage / 100
            uploading.value.progress = Math.floor((currentFileProgress / options.totalSteps) * 100)
        },
    })
    return result
}

watch(files, async (value) => {
    // Prevent infinite loop by checking if value is empty/null
    if (!value || (Array.isArray(value) && value.length === 0)) return

    uploading.value.state = true

    try {
        if (Array.isArray(value)) {
            // Initialize model.value as array if not already
            if (!Array.isArray(model.value))
                model.value = [] as unknown as M extends true ? Image[] : Image | null

            for (const uploadItem of value) {
                addLog(`Uploading ${uploadItem.name}...`)
                const ext = uploadItem.name.split('.').pop()
                const name = `${props.prefix || ''}/${nanoid()}.${ext}`
                const result = await handleUpload(uploadItem, {
                    name,
                    totalSteps: value.length + 1,
                })
                if (result.error || !result.data) {
                    addLog(result.error?.message || 'Failed to upload', 'error')
                    throw result.error
                }
                ;(model.value as Image[]).push({
                    src: createCleanURL(result.data.url).replace(
                        `https://${config.tigrisStorage.bucket}.t3.storage.dev`,
                        config.public.imagesDomain
                    ),
                    alt: undefined,
                })
                addLog('Uploaded successfully.')
            }
        } else {
            addLog(`Uploading ${value.name}...`)
            const ext = value.name.split('.').pop()
            const name = `${props.prefix || ''}/${nanoid(6)}.${ext}`
            const result = await handleUpload(value, { name, totalSteps: 2 })
            if (result.error || !result.data) {
                addLog(result.error?.message || 'Failed to upload', 'error')
                throw result.error
            }
            const newUrl = createCleanURL(result.data.url).replace(
                `https://${config.tigrisStorage.bucket}.t3.storage.dev`,
                config.public.imagesDomain
            )
            await nextTick()
            model.value = {
                src: newUrl,
                alt: undefined,
            } as M extends true ? Image[] : Image | null
            addLog('Uploaded successfully.')
        }

        // Reset files after upload completes
        await nextTick()
        files.value = (props.multiple ? [] : null) as
            | (M extends true ? File[] : File)
            | null
            | undefined
    } catch (error) {
        console.error(error)
    } finally {
        uploading.value.state = false
    }
})

const isImage = (url: string) => {
    const cleanURL = createCleanURL(url)
    return (
        cleanURL.endsWith('.png') ||
        cleanURL.endsWith('.jpg') ||
        cleanURL.endsWith('.jpeg') ||
        cleanURL.endsWith('.gif') ||
        cleanURL.endsWith('.webp') ||
        cleanURL.endsWith('.svg') ||
        cleanURL.endsWith('.avif')
    )
}

// Reactive computed for uploaded files with image detection
const uploadedFiles = computed(() => {
    if (!model.value) return []
    const items = Array.isArray(model.value) ? model.value : [model.value]
    return items.map((item) => ({
        url: item.src,
        isImage: isImage(item.src),
    }))
})
</script>

<template>
    <div class="flex w-full flex-col gap-2">
        <UFileUpload v-model="files" v-bind="props">
            <template v-if="uploading.state" #default>
                <div
                    class="bg-default border-default flex w-full flex-1 flex-col items-stretch justify-center gap-2 rounded-lg border p-4 text-sm transition-[background]"
                >
                    <span>Uploading...</span>
                    <UProgress :value="uploading.progress" />
                    <ConsoleLog :logs="uploading.logs" class="h-32" />
                </div>
            </template>
        </UFileUpload>

        <div
            v-if="model && (Array.isArray(model) ? model.length > 0 : true)"
            class="flex w-full flex-col gap-2"
        >
            <div
                v-for="(uploaded, index) in uploadedFiles"
                :key="`uploaded-${index}`"
                class="flex items-center gap-2"
            >
                <NuxtImg
                    v-if="uploaded.isImage"
                    :src="uploaded.url"
                    alt=""
                    class="size-10 rounded-md object-cover"
                />
                <div
                    v-else
                    class="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md"
                >
                    <Icon name="mingcute:file-fill" size="20" />
                </div>

                <span class="text-toned text-sm">{{ uploaded.url }}</span>
                <UButton
                    icon="mingcute:close-line"
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    @click="
                        props.multiple
                            ? (model as Image[]).splice(index, 1)
                            : (model = null as unknown as M extends true ? Image[] : Image | null)
                    "
                />
            </div>
        </div>
    </div>
</template>
