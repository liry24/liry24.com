<script setup lang="ts">
const { plan, pending, itemId } = defineProps<{
    plan: ComposerPlan
    pending: boolean
    itemId: string
}>()
const emit = defineEmits<{ saved: []; ready: [submit: (() => Promise<void>) | undefined] }>()
if (!plan.model) throw new Error('Choose a model before opening its form.')
const { open, busy: writing, setBusy, preparation } = useAdminComposer()
const { form, id, descriptor, values, receipt, save, error, hasUnsavedChanges } = await useLitiForm(
    plan.model,
    {
        id: plan.entryId,
        defaultValues: plan.values,
        onSuccess: (_receipt, { hasUnsavedChanges }) => {
            if (!hasUnsavedChanges) emit('saved')
        },
    },
)
const { upload, busy: uploading, error: uploadError } = useImageUpload(plan.model, form, id)
const prepared = preparation(
    itemId + ':' + plan.model + ':' + (plan.entryId ?? 'new'),
    values.value.data,
)
const { baseline } = prepared
if (prepared.draft) {
    form.setFieldValue(
        'data',
        structuredClone(toRaw(prepared.draft.data)) as typeof values.value.data,
    )
    receipt.value = prepared.draft.receipt
}
watch(
    [values, receipt],
    () => {
        prepared.draft = {
            data: structuredClone(toRaw(values.value.data)),
            receipt: receipt.value ? structuredClone(toRaw(receipt.value)) : null,
        }
    },
    { deep: true, immediate: true, flush: 'sync' },
)
const invalid = ref(false),
    failure = ref(''),
    full = ref(false)
const fields = computed(() =>
    descriptor.value
        ? modelFields(descriptor.value).filter(
              (field) => full.value || plan.visibleFields.includes(field.key),
          )
        : [],
)
const busy = computed(() => pending || writing.value || uploading.value)
async function submit() {
    if (busy.value || invalid.value) return
    setBusy(itemId, true)
    failure.value = ''
    try {
        await save()
    } catch (cause) {
        failure.value = adminErrorMessage(cause, 'Save failed.')
    } finally {
        setBusy(itemId, false)
    }
}
watch(
    () => plan.values,
    (incoming) => {
        if (busy.value) return
        const updates = composerValueUpdates(values.value.data, baseline, incoming)
        form.setFieldValue('data', { ...values.value.data, ...updates })
        Object.assign(baseline, updates)
    },
    { immediate: true },
)
const removeGuard = useRouter().beforeEach(
    () => !hasUnsavedChanges.value || window.confirm('Discard unsaved changes?'),
)
onMounted(() => emit('ready', submit))
onScopeDispose(() => {
    removeGuard()
    setBusy(itemId, false)
    emit('ready', undefined)
})
</script>
<template>
    <form.Subscribe :selector="(state) => state.isSubmitting" v-slot="saving">
        <form class="grid gap-4" @submit.prevent="submit">
            <UAlert
                v-if="error || failure || uploadError"
                :title="failure || uploadError || String(error)"
                color="error"
            />
            <AdminComposerSurface
                :plan="
                    full ? { ...plan, visibleFields: plan.fields.map((field) => field.key) } : plan
                "
            >
                <template #field="{ fieldName }"
                    ><AdminFormModelFields
                        :form
                        :fields="fields.filter((field) => field.key === fieldName)"
                        :disabled="pending"
                        :uploading
                        @upload="upload"
                        @invalid="invalid = $event"
                /></template>
                <template #action
                    ><UButton
                        type="submit"
                        :label="descriptor?.storage === 'content' ? 'Save Draft' : 'Save'"
                        :loading="saving"
                        :disabled="busy || invalid"
                        color="neutral"
                        block
                /></template>
            </AdminComposerSurface>
            <div class="flex justify-between gap-2">
                <UButton
                    :label="full ? 'Show suggested fields' : 'Show all fields'"
                    variant="link"
                    @click="full = !full"
                /><UButton
                    :to="'/admin/' + plan.model"
                    label="Open full screen"
                    variant="link"
                    @click="open = false"
                />
            </div>
        </form>
    </form.Subscribe>
</template>
