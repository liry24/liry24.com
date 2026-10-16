<script setup lang="ts">
const { modelName, id, categories } = defineProps<{
    modelName: string
    id?: string
    categories?: string[]
}>()
const emit = defineEmits<{ close: [saved: boolean] }>()

const { form, fields, upload, operation, meta, error, status, features, display } =
    await useAdminForm(modelName, {
        id: () => id,
        onSuccess: () => {
            emit('close', true)
        },
    })

const conflict = computed(() => error.value?.data?.code === 'SITE_ADMIN_CONFLICT')
const uploading = computed(() => operation.value === 'upload')
const editableFields = computed(() => fields.value.filter((field) => field.key !== 'slug'))
</script>

<template>
    <form.Subscribe
        :selector="(state) => ({ values: state.values, saving: state.isSubmitting })"
        v-slot="{ values, saving }"
    >
        <UModal
            :title="`${id ? 'Edit' : 'New'} ${meta.label}`"
            :description="id ? `Editing #${id}` : `Add a new ${meta.label.toLowerCase()}`"
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
                <UAlert v-if="error" :title="error?.message" color="error" class="mb-4" />
                <form id="admin-entry-form" class="grid gap-4" @submit.prevent="form.handleSubmit">
                    <form.Field
                        v-for="descriptor in editableFields"
                        :key="descriptor.key"
                        :name="descriptor.name"
                    >
                        <template #default="{ field }">
                            <AdminFormField
                                :descriptor
                                :model-value="field.value"
                                :errors="field.errors"
                                :disabled="uploading || saving"
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
                        label="Slug"
                        description="Leave empty to use the label when publishing."
                        ><UInput
                            :model-value="String(values.slug ?? '')"
                            @update:model-value="(value) => form.setFieldValue('slug', value)"
                            :placeholder="entrySlugSuggestion(display(values).title)"
                            variant="soft"
                            class="w-full"
                    /></UFormField>
                </form>
            </template>
            <template #footer>
                <UButton
                    type="submit"
                    form="admin-entry-form"
                    :label="features.publishing ? 'Save Draft' : 'Save'"
                    color="neutral"
                    size="lg"
                    block
                    :loading="saving"
                    :disabled="conflict || uploading"
                />
            </template>
        </UModal>
    </form.Subscribe>
</template>
