<script setup lang="ts">
import type { ModelName } from 'liti/types'
const open = defineModel<boolean>('open', { default: false })
const { modelName, id, categories } = defineProps<{
    modelName: ModelName
    id?: string
    categories?: string[]
}>()
const emit = defineEmits<{ close: [saved: boolean]; 'after:leave': [] }>()
const invalid = ref(false),
    failure = ref('')
const {
    form,
    id: entryId,
    descriptor,
    values,
    save,
    error,
    warnings,
    hasUnsavedChanges,
} = await useLitiForm(modelName, {
    id: () => id,
    onSuccess: (_receipt, context) => {
        if (!context.hasUnsavedChanges) emit('close', true)
    },
})
const { upload, busy: uploading, error: uploadError } = useImageUpload(modelName, form, entryId)
const fields = computed(() => (descriptor.value ? modelFields(descriptor.value) : []))
const title = computed(() => descriptor.value?.label ?? modelName)
async function submit() {
    if (invalid.value || uploading.value) return
    failure.value = ''
    try {
        await save()
    } catch (cause) {
        failure.value = adminErrorMessage(cause, 'Save failed.')
    }
}
function close() {
    if (!hasUnsavedChanges.value || window.confirm('Discard unsaved changes?')) emit('close', false)
}
</script>
<template>
    <form.Subscribe :selector="(state) => state.isSubmitting" v-slot="saving">
        <UModal
            v-model:open="open"
            :title="`${id ? 'Edit' : 'New'} ${title}`"
            :description="id ? `Editing #${id}` : `Add a new ${title}`"
            :dismissible="false"
            :ui="{
                content: ['games', 'gameStats'].includes(modelName)
                    ? 'sm:max-w-4xl'
                    : 'sm:max-w-lg',
            }"
            @after:leave="emit('after:leave')"
            @update:open="
                (value) => {
                    if (!value) close()
                }
            "
        >
            <template #body>
                <UAlert
                    v-if="failure || error || uploadError"
                    :title="failure || uploadError || String(error)"
                    color="error"
                    class="mb-4"
                />
                <UAlert
                    v-for="warning in warnings"
                    :key="warning.code"
                    :title="warning.message"
                    color="warning"
                />
                <form id="admin-entry-form" class="grid gap-4" @submit.prevent="submit">
                    <AdminFormGameSearch
                        v-if="modelName === 'games' && !id"
                        @select="emit('close', true)"
                    />
                    <AdminFormGameFields
                        v-else-if="['games', 'gameStats'].includes(modelName)"
                        :model-name="modelName"
                        :values="values.data"
                        :form
                        :upload
                        :disabled="uploading"
                    />
                    <AdminFormModelFields
                        v-else
                        :form
                        :fields
                        :categories
                        :uploading
                        @upload="upload"
                        @invalid="invalid = $event"
                    />
                </form>
            </template>
            <template #footer>
                <UButton label="Cancel" variant="ghost" color="neutral" @click="close" />
                <UButton
                    v-if="modelName !== 'games' || id"
                    type="submit"
                    form="admin-entry-form"
                    :label="descriptor?.storage === 'content' ? 'Save Draft' : 'Save'"
                    :loading="saving"
                    :disabled="invalid || uploading"
                    color="neutral"
                />
            </template>
        </UModal>
    </form.Subscribe>
</template>
