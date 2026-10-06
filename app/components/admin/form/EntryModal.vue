<script setup lang="ts">
import type { ModelDescriptor } from '@liria24/site-admin'
import { useSiteAdminForm } from '@liria24/site-admin/form'
import type { EntryRecord } from '@liria24/site-admin/server'
const props = defineProps<{
    modelName: string
    descriptor: ModelDescriptor
    data?: EntryRecord
    categories?: string[]
}>()
const emit = defineEmits<{ close: [saved: boolean] }>()
const singular =
    adminModels[props.modelName as keyof typeof adminModels]?.singular || props.modelName
const slug = ref(props.data?.slug || '')
const { form, conflict, serverError, asset } = useSiteAdminForm({
    modelName: props.modelName,
    descriptor: props.descriptor,
    entry: props.data,
    get slug() {
        return slug.value || undefined
    },
    onSuccess: () => emit('close', true),
})
const localError = ref('')
const saving = ref(false)
const uploading = ref(false)
const uploadedNames = ref<Record<string, string>>({})
const fields = computed(() =>
    Object.entries(props.descriptor.fields).sort(([left, a], [right, b]) => {
        const priority = (name: string, kind: string) =>
            name === props.descriptor.displayFields?.title
                ? 0
                : ['image', 'images'].includes(kind)
                  ? 1
                  : 2
        return priority(left, a.kind) - priority(right, b.kind)
    }),
)
const fieldLabel = (name: string) =>
    name === 'href'
        ? 'URL'
        : name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase())
const references = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : [])
async function save() {
    saving.value = true
    localError.value = ''
    try {
        await form.handleSubmit()
    } catch (error) {
        localError.value = error instanceof Error ? error.message : 'Save failed'
    } finally {
        saving.value = false
    }
}
async function upload(
    files: File | File[] | null | undefined,
    name: string,
    multiple: boolean,
    current: unknown,
) {
    if (!files) return
    uploading.value = true
    try {
        const uploaded = []
        for (const file of Array.isArray(files) ? files : [files]) {
            const record = await asset.upload(file)
            uploaded.push(record.id)
            uploadedNames.value[adminAssetUrl(record.id)!] = file.name
        }
        if (multiple) form.setFieldValue(name, [...references(current), ...uploaded])
        else if (uploaded[0]) asset.set(name, uploaded[0])
    } catch {
        /* The Site Admin upload controller exposes the failure. */
    } finally {
        uploading.value = false
    }
}
</script>

<template>
    <UModal
        :title="`${data ? 'Edit' : 'New'} ${singular}`"
        :description="data ? `Editing #${data.slug}` : `Add a new ${singular.toLowerCase()}`"
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
                v-if="serverError || localError"
                :title="serverError?.message || localError"
                color="error"
                class="mb-4"
            />
            <form id="admin-entry-form" class="grid gap-4" @submit.prevent="save">
                <form.Field v-for="[name, descriptor] in fields" :key="name" :name="name">
                    <template #default="{ field }">
                        <UFormField
                            :label="descriptor.label || fieldLabel(name)"
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
                                    @update:model-value="
                                        (files) =>
                                            upload(
                                                files,
                                                name,
                                                descriptor.kind === 'images',
                                                field.value,
                                            )
                                    "
                                />
                                <UProgress
                                    v-if="uploading && asset.progress.value !== null"
                                    :model-value="asset.progress.value * 100"
                                    aria-label="Upload progress"
                                />
                                <p v-if="asset.error.value" class="text-error text-sm" role="alert">
                                    {{ asset.error.value }}
                                </p>
                                <div
                                    v-for="(reference, index) in references(field.value)"
                                    :key="adminAssetUrl(reference)"
                                    class="flex min-w-0 items-center gap-2"
                                >
                                    <img
                                        v-if="descriptor.kind !== 'file'"
                                        :src="adminAssetUrl(reference)"
                                        alt=""
                                        class="size-10 shrink-0 rounded-md object-cover"
                                    />
                                    <UIcon v-else name="mingcute:file-fill" class="size-5" />
                                    <span class="text-toned min-w-0 flex-1 truncate text-sm">{{
                                        uploadedNames[adminAssetUrl(reference)!] ||
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
                                                : asset.clear(name)
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
                                :placeholder="singular + ' ' + fieldLabel(name)"
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
                                    name === 'href'
                                        ? 'https://example.com'
                                        : singular + ' ' + fieldLabel(name)
                                "
                                variant="soft"
                                :size="name === props.descriptor.displayFields?.title ? 'xl' : 'md'"
                                class="w-full"
                                @update:model-value="field.handleChange"
                                @blur="field.handleBlur"
                            >
                                <template v-if="name === 'icon' && field.value" #trailing
                                    ><UIcon :name="String(field.value)" class="size-5"
                                /></template>
                            </UInput>
                            <div
                                v-if="name === 'category' && categories?.length"
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
                <UFormField label="Slug" description="Leave empty to generate an identifier."
                    ><UInput
                        v-model="slug"
                        :placeholder="singular.toLowerCase() + '-slug'"
                        variant="soft"
                        class="w-full"
                /></UFormField>
            </form>
        </template>
        <template #footer>
            <UButton
                type="submit"
                form="admin-entry-form"
                label="Save Draft"
                color="neutral"
                size="lg"
                block
                :loading="saving"
                :disabled="conflict || uploading"
            />
        </template>
    </UModal>
</template>
