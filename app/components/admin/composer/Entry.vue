<script setup lang="ts">
interface Props {
    plan: ComposerPlan
    pending: boolean
    itemId: string
}
const { plan, pending, itemId } = defineProps<Props>()
const emit = defineEmits<{
    saved: []
    ready: [submit: (() => Promise<void>) | undefined]
}>()

const { open, busy: writing, setBusy, preparation } = useAdminComposer()
const { form, fields, upload, operation, error, state, features } = await useLitiForm(
    String(plan.model),
    {
        instance: 'composer:' + itemId,
        id: plan.entryId,
        defaultValues: plan.values,
        onSuccess: () => emit('saved'),
    },
)

const { baseline } = preparation(
    itemId + ':' + plan.model + ':' + (plan.entryId ?? 'new'),
    form.state.values,
)
const conflict = computed(() => state.value.conflict)
const busy = computed(() => pending || writing.value || !state.value.ready || state.value.busy)

const submit = async () => {
    if (state.value.can.save) await form.handleSubmit()
}

const full = ref(false)
const descriptors = computed(() =>
    Object.fromEntries(fields.value.map((field) => [field.key, field])),
)
const visiblePlan = computed(() =>
    full.value ? { ...plan, visibleFields: plan.fields.map((field) => field.key) } : plan,
)

const removeNavigationGuard = useRouter().beforeEach(() => state.value.canLeave)
onScopeDispose(removeNavigationGuard)

watch(
    () => state.value.busy,
    (value) => {
        setBusy(itemId, value)
    },
    { flush: 'sync', immediate: true },
)
onScopeDispose(() => {
    setBusy(itemId, false)
    emit('ready', undefined)
})
watch(
    () => plan.values,
    (values) => {
        if (operation.value) return
        for (const [key, value] of Object.entries(
            composerValueUpdates(form.state.values, baseline, values),
        )) {
            if (!fields.value.some((field) => field.key === key)) continue
            form.setFieldValue(key, value)
            baseline[key] = value
        }
    },
    { immediate: true },
)
onMounted(() => emit('ready', submit))
</script>

<template>
    <form.Subscribe :selector="(state) => ({ saving: state.isSubmitting })" v-slot="{ saving }">
        <form class="grid gap-4" @submit.prevent="!busy && submit()">
            <UAlert
                v-if="error"
                :title="error.message"
                :description="
                    conflict
                        ? 'Your input is kept. Open the full screen to compare with the latest version.'
                        : undefined
                "
                color="error"
            />
            <fieldset :disabled="busy || conflict" class="min-w-0">
                <AdminComposerSurface :plan="visiblePlan">
                    <template #field="{ fieldName: name }">
                        <form.Field v-if="descriptors[name]" :name="descriptors[name].name">
                            <template #default="{ field }">
                                <AdminFormField
                                    :descriptor="descriptors[name]"
                                    :model-value="field.value"
                                    :errors="field.errors"
                                    :disabled="busy || saving"
                                    :uploading="operation === 'upload'"
                                    @update:model-value="field.handleChange"
                                    @blur="field.handleBlur"
                                    @upload="(files) => upload(descriptors[name]!.name, files)"
                                />
                            </template>
                        </form.Field>
                    </template>
                    <template #action>
                        <UButton
                            type="submit"
                            :label="features.publishing ? 'Save Draft' : 'Save'"
                            icon="mingcute:save-line"
                            color="neutral"
                            size="lg"
                            block
                            :loading="saving"
                            :disabled="busy || conflict"
                        />
                    </template>
                </AdminComposerSurface>
            </fieldset>
            <div class="flex flex-wrap items-center justify-between gap-2">
                <UButton
                    :label="full ? 'Show suggested fields' : 'Show all fields'"
                    variant="link"
                    color="neutral"
                    :disabled="busy"
                    @click="full = !full"
                />
                <UButton
                    :to="'/admin/' + plan.model"
                    label="Open full screen"
                    :disabled="busy"
                    @click="open = false"
                    variant="link"
                    color="neutral"
                />
            </div>
        </form>
    </form.Subscribe>
</template>
