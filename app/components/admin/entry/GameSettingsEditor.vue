<script setup lang="ts">
import { fieldErrors, submitForm } from 'vite-hub/forms/client'

const props = defineProps<{
    item?: AdminEntryRecord<GameRecordData>
    finalFocus?: () => HTMLElement | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const toast = useToast()
const game = ref<GameRecordData>()
const metricsText = ref('')
const iconFiles = shallowRef<Array<File>>([])
const saving = ref(false)
const { uploading, uploadSingle } = useAdminMediaUpload('games')
const busy = computed(() => saving.value || uploading.value)
const errorMessage = ref('')
const errors = ref<Record<string, string>>({})

watch(open, (value) => {
    if (!value || !props.item) return
    game.value = { ...props.item.data }
    metricsText.value = JSON.stringify(game.value.metrics ?? [], null, 2)
    errorMessage.value = ''
    errors.value = {}
})

async function upload(files: Array<File>) {
    iconFiles.value = files
    const file = files[0]
    if (!file || !game.value || saving.value) return
    try {
        const uploaded = await uploadSingle(file, {
            successTitle: 'Uploaded image',
            fallbackError: 'Could not upload image.',
        })
        if (uploaded) game.value.icon = uploaded
    } finally {
        iconFiles.value = []
    }
}

async function save() {
    if (!props.item || !game.value || busy.value) return
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
    <UiFormDialog
        v-model:open="open"
        :title="`Edit Game settings: ${item?.id ?? ''}`"
        submit-label="Save game"
        :busy="busy"
        :saving="saving"
        :final-focus="finalFocus"
        @submit="save"
    >
        <div v-if="game" class="grid gap-4">
            <UiAlert v-if="errorMessage">{{ errorMessage }}</UiAlert>
            <UiField label="Name" required>
                <UiInput :model-value="game.name" disabled />
            </UiField>
            <UiField label="Primary metric" :error="errors['data.primaryMetric']">
                <UiInput
                    :model-value="game.primaryMetric ?? ''"
                    :disabled="busy"
                    @update:model-value="game.primaryMetric = $event || undefined"
                />
            </UiField>
            <UiField label="Icon upload" :description="game.icon?.pathname">
                <div class="flex flex-wrap items-center gap-3">
                    <UiFileInput
                        :value="iconFiles"
                        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                        :disabled="busy"
                        @value-change="upload"
                        @reject="
                            toast.add({
                                title: 'Choose a supported image file',
                                color: 'error',
                            })
                        "
                    >
                        <UiFileInputTrigger>
                            {{ uploading ? 'Uploading…' : 'Choose image' }}
                        </UiFileInputTrigger>
                    </UiFileInput>
                    <img
                        v-if="game.icon"
                        :src="mediaUrl(game.icon)"
                        alt="Game icon preview"
                        class="size-10 rounded object-cover"
                    />
                </div>
            </UiField>
            <UiField label="Metrics JSON" :error="errors['data.metrics']">
                <UiTextarea v-model="metricsText" :rows="6" :disabled="busy" class="font-mono" />
            </UiField>
        </div>
    </UiFormDialog>
</template>
