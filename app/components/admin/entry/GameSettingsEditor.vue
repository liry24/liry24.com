<script setup lang="ts">
import { fieldErrors, submitForm } from 'vite-hub/forms/client'

const props = defineProps<{ item?: AdminEntryRecord<GameRecordData> }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const toast = useToast()
const game = ref<GameRecordData>()
const metricsText = ref('')
const saving = ref(false)
const uploading = ref(false)
const errorMessage = ref('')
const errors = ref<Record<string, string>>({})

watch(open, (value) => {
    if (!value || !props.item) return
    game.value = { ...props.item.data }
    metricsText.value = JSON.stringify(game.value.metrics ?? [], null, 2)
    errorMessage.value = ''
    errors.value = {}
})

async function upload(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file || !game.value || saving.value || uploading.value) return
    uploading.value = true
    try {
        const body = new FormData()
        body.append('file', file)
        body.append('folder', 'games')
        game.value.icon = await $fetch<MediaReference>('/api/admin/media', { method: 'POST', body })
        toast.add({ title: 'Uploaded image', color: 'success' })
    } catch (error) {
        toast.add({
            title: 'Upload failed',
            description: adminErrorMessage(error, 'Could not upload image.'),
            color: 'error',
        })
    } finally {
        uploading.value = false
        input.value = ''
    }
}

async function save() {
    if (!props.item || !game.value || saving.value || uploading.value) return
    saving.value = true
    errorMessage.value = ''
    errors.value = {}
    try {
        const { order: _order, ...data } = game.value
        data.metrics = gameFieldsSchema.shape.metrics.parse(JSON.parse(metricsText.value || '[]'))
        const [error] = await submitForm('game', { id: props.item.id, data })
        if (error) {
            errorMessage.value = error.message
            errors.value = fieldErrors(error)
            return
        }
        toast.add({ title: 'Saved game', color: 'success' })
        open.value = false
        emit('saved')
    } catch (error) {
        errorMessage.value = adminErrorMessage(error, 'Invalid field data.')
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <UModal
        v-model:open="open"
        :title="`Edit Game settings: ${item?.id ?? ''}`"
        :dismissible="!saving && !uploading"
    >
        <template #body>
            <div v-if="game" class="grid gap-4">
                <UAlert
                    v-if="errorMessage"
                    role="alert"
                    :title="errorMessage"
                    color="error"
                    variant="subtle"
                    :ui="{ title: 'text-red-700 dark:text-red-400' }"
                />
                <UFormField label="Name" required
                    ><UInput :model-value="game.name" disabled
                /></UFormField>
                <UFormField label="Primary metric" :error="errors['data.primaryMetric']">
                    <UInput v-model="game.primaryMetric" />
                </UFormField>
                <UFormField label="Icon upload">
                    <input
                        type="file"
                        accept="image/*"
                        :disabled="uploading || saving"
                        @change="upload"
                    />
                </UFormField>
                <UFormField label="Metrics JSON" :error="errors['data.metrics']">
                    <UTextarea v-model="metricsText" :rows="6" class="font-mono" />
                </UFormField>
                <div class="flex justify-end gap-2">
                    <UButton
                        label="Cancel"
                        variant="ghost"
                        color="neutral"
                        :disabled="saving || uploading"
                        @click="open = false"
                    />
                    <UButton
                        label="Save game"
                        :loading="saving"
                        :disabled="uploading"
                        @click="save"
                    />
                </div>
            </div>
        </template>
    </UModal>
</template>
