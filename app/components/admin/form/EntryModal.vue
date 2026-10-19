<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

interface Props {
    modelName: string
    id?: string
    categories?: string[]
}
const { modelName, id, categories } = defineProps<Props>()
const emit = defineEmits<{
    close: [saved: boolean]
    'after:leave': []
}>()

const { form, fields, upload, operation, meta, error, status, features, display } = useAdminForm(
    modelName,
    {
        id: () => id,
        onSuccess: () => {
            emit('close', true)
        },
    },
)

const conflict = computed(() => error.value?.data?.code === 'SITE_ADMIN_CONFLICT')
const uploading = computed(() => operation.value === 'upload')
const loading = computed(() => status.value === 'idle' || status.value === 'pending')
const editableFields = computed(() => fields.value.filter((field) => field.key !== 'slug'))

const validationMessages = (value: unknown): string[] => {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.flatMap(validationMessages)
    if (!value || typeof value !== 'object') return []
    if ('message' in value && typeof value.message === 'string') return [value.message]
    return Object.entries(value).flatMap(([key, error]) =>
        validationMessages(error).map((message) => `${key}: ${message}`),
    )
}
</script>

<template>
    <form.Subscribe
        :selector="
            (state) => ({ values: state.values, saving: state.isSubmitting, errors: state.errors })
        "
        v-slot="{ values, saving, errors }"
    >
        <UModal
            v-model:open="open"
            @after:leave="emit('after:leave')"
            :title="`${id ? 'Edit' : 'New'} ${meta.label}`"
            :description="id ? `Editing #${id}` : `Add a new ${meta.label.toLowerCase()}`"
            :dismissible="false"
            :ui="{
                content: ['games', 'gameStats'].includes(modelName)
                    ? 'sm:max-w-4xl'
                    : 'sm:max-w-lg',
            }"
            @update:open="
                (value) => {
                    if (!value) emit('close', false)
                }
            "
        >
            <template #body>
                <UProgress v-if="loading" aria-label="Loading editor" class="mb-4" />
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
                <UAlert v-if="error" :title="error?.message" color="error" class="mb-4" />
                <UAlert
                    v-if="['games', 'gameStats'].includes(modelName) && errors.length"
                    title="Check the fields before saving"
                    :description="validationMessages(errors).join('; ')"
                    color="error"
                    class="mb-4"
                />
                <form
                    id="admin-entry-form"
                    class="grid gap-4"
                    @submit.prevent="!loading && !operation && !conflict && form.handleSubmit()"
                >
                    <AdminFormGameSearch
                        v-if="modelName === 'games' && !id"
                        @select="emit('close', true)"
                    />
                    <AdminFormGameFields
                        v-else-if="['games', 'gameStats'].includes(modelName)"
                        :model-name
                        :values
                        :form
                        :upload
                        :disabled="loading || uploading || saving"
                    />
                    <form.Field
                        v-for="descriptor in ['games', 'gameStats'].includes(modelName)
                            ? []
                            : editableFields"
                        :key="descriptor.key"
                        :name="descriptor.name"
                    >
                        <template #default="{ field }">
                            <AdminFormField
                                :descriptor
                                :model-value="field.value"
                                :errors="field.errors"
                                :disabled="loading || uploading || saving"
                                :uploading
                                :label="meta.label"
                                :categories
                                @update:model-value="field.handleChange"
                                @blur="field.handleBlur"
                                @upload="(files) => upload(descriptor.name, files)"
                            />
                        </template>
                    </form.Field>
                    <UFormField
                        v-if="!['games', 'gameStats'].includes(modelName)"
                        label="Slug"
                        description="Leave empty to use the label when publishing."
                        ><UInput
                            :model-value="String(values.slug ?? '')"
                            @update:model-value="(value) => form.setFieldValue('slug', value)"
                            :disabled="loading || uploading || saving"
                            :placeholder="entrySlugSuggestion(display(values).title)"
                            variant="soft"
                            class="w-full"
                    /></UFormField>
                </form>
            </template>
            <template v-if="modelName !== 'games' || id" #footer>
                <UButton
                    type="submit"
                    form="admin-entry-form"
                    :label="features.publishing ? 'Save Draft' : 'Save'"
                    color="neutral"
                    size="lg"
                    block
                    :loading="saving"
                    :disabled="loading || saving || conflict || uploading"
                />
            </template>
        </UModal>
    </form.Subscribe>
</template>
