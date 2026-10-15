<script setup lang="ts">
import { useSelector } from '@tanstack/vue-form'
const props = defineProps<{ modelName: string; id?: string; categories?: string[] }>()
const emit = defineEmits<{ close: [saved: boolean] }>()
const singular =
    adminModels[props.modelName as keyof typeof adminModels]?.singular || props.modelName
// This renderer accepts every model; individual editors retain model-specific field types.
const resource = await useAdminEntry(props.modelName, props.id ?? null)
const {
    form,
    fields,
    upload: uploadFiles,
} = useEntryForm(resource, {
    onSuccess: () => {
        emit('close', true)
    },
})
const values = useSelector(form.atom, (state) => state.values)
const saving = useSelector(form.atom, (state) => state.isSubmitting)
const slug = computed({
    get: () => String(values.value.slug ?? ''),
    set: (value) => form.setFieldValue('slug', value),
})
const conflict = computed(() => resource.error.value?.data?.code === 'SITE_ADMIN_CONFLICT')
const uploading = computed(() => resource.status.value === 'pending' && !saving.value)
const editableFields = computed(() => fields.value.filter((field) => field.key !== 'slug'))
const suggestedSlug = computed(() => entrySlugSuggestion(resource.display(values.value).title))
const references = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : [])
async function upload(files: File | File[] | null | undefined, name: string) {
    try {
        await uploadFiles(name, files)
    } catch {
        /* resource.error displays the failure. */
    }
}
const assetUrl = (value: unknown) =>
    value && typeof value === 'object' && 'url' in value ? String(value.url) : undefined
</script>

<template>
    <UModal
        :title="`${id ? 'Edit' : 'New'} ${singular}`"
        :description="id ? `Editing #${id}` : `Add a new ${singular.toLowerCase()}`"
        :dismissible="false"
        :ui="{ content: modelName === 'posts' ? 'sm:max-w-4xl' : 'sm:max-w-lg' }"
        @update:open="
            (value) => {
                if (!value) emit('close', false)
            }
        "
    >
        <template #body>
            <UAlert
                v-if="conflict"
                title="Conflict detected"
                description="Reload latest before saving again."
                color="warning"
                class="mb-4"
            >
                <template #actions
                    ><UButton label="Reload latest" @click="emit('close', true)"
                /></template>
            </UAlert>
            <UAlert
                v-if="resource.error.value"
                :title="resource.error.value?.message"
                color="error"
                class="mb-4"
            />
            <form id="admin-entry-form" class="grid gap-4" @submit.prevent="form.handleSubmit">
                <form.Field
                    v-for="descriptor in editableFields"
                    :key="descriptor.key"
                    :name="descriptor.name"
                >
                    <template #default="{ field }">
                        <UFormField
                            :label="descriptor.label"
                            :required="descriptor.required"
                            :error="
                                field.errors
                                    .map((error) =>
                                        typeof error === 'string' ? error : error.message,
                                    )
                                    .join(', ') || undefined
                            "
                        >
                            <USelect
                                v-if="descriptor.kind === 'select'"
                                :items="[...(descriptor.values || [])]"
                                :model-value="String(field.value ?? '')"
                                variant="soft"
                                class="w-full"
                                @update:model-value="field.handleChange"
                            />
                            <div
                                v-else-if="['image', 'images', 'file'].includes(descriptor.kind)"
                                class="grid gap-2"
                            >
                                <UFileUpload
                                    :model-value="null"
                                    reset
                                    :multiple="descriptor.kind === 'images'"
                                    :accept="
                                        descriptor.accept?.join(',') ||
                                        (descriptor.kind === 'file' ? '*' : 'image/*')
                                    "
                                    :label="
                                        descriptor.kind === 'file' ? 'Upload File' : 'Upload Image'
                                    "
                                    icon="mingcute:upload-3-fill"
                                    :disabled="uploading || saving"
                                    class="min-h-32 w-full"
                                    @update:model-value="(files) => upload(files, descriptor.key)"
                                />
                                <UProgress
                                    v-if="uploading"
                                    :model-value="undefined"
                                    aria-label="Upload progress"
                                />
                                <div
                                    v-for="(reference, index) in references(field.value)"
                                    :key="adminAssetId(reference)"
                                    class="flex min-w-0 items-center gap-2"
                                >
                                    <img
                                        v-if="descriptor.kind !== 'file'"
                                        :src="
                                            adminAssetId(reference)
                                                ? assetUrl(reference)
                                                : undefined
                                        "
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
                                        :disabled="uploading || saving"
                                        @click="
                                            descriptor.kind === 'images'
                                                ? field.handleChange(
                                                      references(field.value).filter(
                                                          (_, i) => i !== index,
                                                      ),
                                                  )
                                                : field.handleChange(null)
                                        "
                                    />
                                </div>
                            </div>
                            <UTextarea
                                v-else-if="descriptor.kind === 'array'"
                                :model-value="
                                    Array.isArray(field.value) ? field.value.join('\n') : ''
                                "
                                placeholder="One tag per line"
                                variant="soft"
                                class="w-full"
                                autoresize
                                @update:model-value="
                                    (value) => field.handleChange(value.split('\n').filter(Boolean))
                                "
                            />
                            <UTextarea
                                v-else-if="['textarea', 'markdown'].includes(descriptor.kind)"
                                :model-value="String(field.value ?? '')"
                                :rows="descriptor.kind === 'markdown' ? 16 : 3"
                                :placeholder="singular + ' ' + descriptor.label"
                                variant="soft"
                                autoresize
                                class="w-full"
                                :ui="
                                    descriptor.kind === 'markdown'
                                        ? { base: 'font-mono text-sm' }
                                        : undefined
                                "
                                @update:model-value="field.handleChange"
                                @blur="field.handleBlur"
                            />
                            <UInput
                                v-else
                                :model-value="String(field.value ?? '')"
                                :placeholder="
                                    descriptor.key === 'href'
                                        ? 'https://example.com'
                                        : singular + ' ' + descriptor.label
                                "
                                variant="soft"
                                :size="descriptor.key === 'title' ? 'xl' : 'md'"
                                class="w-full"
                                @update:model-value="field.handleChange"
                                @blur="field.handleBlur"
                            >
                                <template v-if="descriptor.key === 'icon' && field.value" #trailing
                                    ><UIcon :name="String(field.value)" class="size-5"
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
                                    @click="field.handleChange(category)"
                                />
                            </div>
                        </UFormField>
                    </template>
                </form.Field>
                <UFormField label="Slug" description="Leave empty to use the label when publishing."
                    ><UInput
                        v-model="slug"
                        :placeholder="suggestedSlug"
                        variant="soft"
                        class="w-full"
                /></UFormField>
            </form>
        </template>
        <template #footer>
            <UButton
                type="submit"
                form="admin-entry-form"
                :label="resource.features.value.publishing ? 'Save Draft' : 'Save'"
                color="neutral"
                size="lg"
                block
                :loading="saving"
                :disabled="conflict || uploading"
            />
        </template>
    </UModal>
</template>
