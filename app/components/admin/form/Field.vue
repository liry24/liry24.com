<script setup lang="ts">
import { formatDate } from '@vueuse/core'

interface Props {
    descriptor: ComposerField
    modelValue: unknown
    errors?: unknown[]
    disabled?: boolean
    uploading?: boolean
    label?: string
    categories?: string[]
}
const {
    descriptor,
    modelValue,
    errors = [],
    disabled = false,
    uploading = false,
    label = '',
    categories,
} = defineProps<Props>()

const emit = defineEmits<{
    'update:modelValue': [value: unknown]
    blur: []
    upload: [files: File | File[] | null | undefined]
    invalid: [value: boolean]
}>()

const update = (value: unknown) =>
    emit(
        'update:modelValue',
        value === null || (descriptor.kind === 'url' && value === '') ? undefined : value,
    )
const jsonInput = ref<string>()
const jsonError = ref('')
function updateJson(value: string) {
    jsonInput.value = value
    try {
        update(value ? JSON.parse(value) : undefined)
        jsonError.value = ''
        emit('invalid', false)
    } catch {
        jsonError.value = 'Enter valid JSON.'
        emit('invalid', true)
    }
}
const dateInput = computed(() => {
    const date = new Date(String(modelValue ?? ''))
    return Number.isNaN(date.getTime()) ? '' : formatDate(date, 'YYYY-MM-DDTHH:mm')
})
const updateDate = (value: string) => {
    if (!value) return update(undefined)
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) update(date.toISOString())
}
const error = computed(
    () =>
        errors
            .map((error) =>
                typeof error === 'string'
                    ? error
                    : error && typeof error === 'object' && 'message' in error
                      ? String(error.message)
                      : '',
            )
            .filter(Boolean)
            .join(', ') || undefined,
)
const references = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : [])
const assetUrl = (value: unknown) =>
    value && typeof value === 'object' && 'pathname' in value && typeof value.pathname === 'string'
        ? mediaUrl({ pathname: value.pathname })
        : undefined
</script>

<template>
    <fieldset :disabled="disabled" class="min-w-0">
        <UFormField
            :label="descriptor.label"
            :required="descriptor.required"
            :error="jsonError || error"
        >
            <USelect
                v-if="descriptor.kind === 'select'"
                :items="[...(descriptor.values || [])]"
                :model-value="String(modelValue ?? '')"
                variant="soft"
                class="w-full"
                @update:model-value="update"
            />
            <div
                v-else-if="['image', 'images', 'file'].includes(descriptor.kind)"
                class="grid gap-2"
            >
                <!-- @vue-generic {boolean, File} -->
                <UFileUpload
                    :model-value="null"
                    reset
                    :multiple="descriptor.kind === 'images'"
                    :accept="
                        descriptor.accept?.join(',') ||
                        (descriptor.kind === 'file' ? '*' : 'image/*')
                    "
                    :label="descriptor.kind === 'file' ? 'Upload File' : 'Upload Image'"
                    icon="mingcute:upload-3-fill"
                    :disabled="uploading || disabled"
                    class="min-h-32 w-full"
                    @update:model-value="(files) => emit('upload', files)"
                />
                <UProgress v-if="uploading" :model-value="undefined" aria-label="Upload progress" />
                <div
                    v-for="(reference, index) in references(modelValue)"
                    :key="assetUrl(reference)"
                    class="flex min-w-0 items-center gap-2"
                >
                    <img
                        v-if="descriptor.kind !== 'file'"
                        :src="assetUrl(reference)"
                        alt=""
                        class="size-10 shrink-0 rounded-md object-cover"
                    />
                    <UIcon v-else name="mingcute:file-fill" class="size-5" />
                    <span class="text-toned min-w-0 flex-1 truncate text-sm">{{
                        `${descriptor.kind === 'file' ? 'File' : 'Image'} ${index + 1}`
                    }}</span>
                    <UButton
                        aria-label="Clear reference"
                        title="Remove image"
                        icon="mingcute:close-line"
                        variant="ghost"
                        color="neutral"
                        size="sm"
                        :disabled="uploading || disabled"
                        @click="
                            descriptor.kind === 'images'
                                ? update(references(modelValue).filter((_, i) => i !== index))
                                : update(null)
                        "
                    />
                </div>
            </div>
            <UTextarea
                v-else-if="descriptor.kind === 'json'"
                :model-value="jsonInput ?? JSON.stringify(modelValue, null, 2) ?? ''"
                class="w-full font-mono"
                autoresize
                @update:model-value="updateJson"
            />
            <UInput
                v-else-if="descriptor.kind === 'number'"
                :model-value="typeof modelValue === 'number' ? modelValue : undefined"
                type="number"
                class="w-full"
                @update:model-value="update(Number.isFinite($event) ? $event : undefined)"
            />
            <UCheckbox
                v-else-if="descriptor.kind === 'boolean'"
                :model-value="Boolean(modelValue)"
                @update:model-value="update"
            />
            <UTextarea
                v-else-if="descriptor.kind === 'array'"
                :model-value="Array.isArray(modelValue) ? modelValue.join('\n') : ''"
                placeholder="One tag per line"
                variant="soft"
                class="w-full"
                autoresize
                @update:model-value="(value) => update(value.split('\n').filter(Boolean))"
            />
            <UTextarea
                v-else-if="['textarea', 'markdown'].includes(descriptor.kind)"
                :model-value="String(modelValue ?? '')"
                :rows="descriptor.kind === 'markdown' ? 16 : 3"
                :placeholder="label + ' ' + descriptor.label"
                variant="soft"
                autoresize
                class="w-full"
                :ui="descriptor.kind === 'markdown' ? { base: 'font-mono text-sm' } : undefined"
                @update:model-value="update"
                @blur="emit('blur')"
            />
            <UInput
                v-else-if="descriptor.kind === 'datetime'"
                :model-value="dateInput"
                type="datetime-local"
                variant="soft"
                class="w-full"
                @update:model-value="updateDate"
                @blur="emit('blur')"
            />
            <UInput
                v-else
                :model-value="String(modelValue ?? '')"
                :placeholder="
                    descriptor.key === 'href'
                        ? 'https://example.com'
                        : label + ' ' + descriptor.label
                "
                variant="soft"
                :size="descriptor.key === 'title' ? 'xl' : 'md'"
                class="w-full"
                @update:model-value="update"
                @blur="emit('blur')"
            >
                <template v-if="descriptor.key === 'icon' && modelValue" #trailing
                    ><UIcon :name="String(modelValue)" class="size-5"
                /></template>
            </UInput>
            <div
                v-if="descriptor.key === 'category' && categories?.length"
                class="mt-2 flex flex-wrap gap-2"
            >
                <UButton
                    v-for="category in categories"
                    :key="category"
                    :label="category"
                    variant="outline"
                    size="sm"
                    @click="update(category)"
                />
            </div>
        </UFormField>
    </fieldset>
</template>
