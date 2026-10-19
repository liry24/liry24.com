<script setup lang="ts">
import type { ComposerPlan } from '~~/shared/utils/adminComposer'

const props = defineProps<{ plan: ComposerPlan; pending: boolean; itemId: string }>()
const emit = defineEmits<{ saved: []; ready: [submit: (() => Promise<void>) | undefined] }>()
const full = ref(false)
const { open, busy: writing, setBusy } = useAdminComposer()
const { form, fields, upload, operation, error, status, features } = await useAdminForm(
    String(props.plan.model),
    {
        instance: 'composer:' + props.itemId,
        id: props.plan.entryId,
        defaultValues: props.plan.values,
        onSuccess: () => emit('saved'),
    },
)
watch(
    operation,
    (value) => {
        setBusy(props.itemId, value !== null)
    },
    { flush: 'sync', immediate: true },
)
onScopeDispose(() => {
    setBusy(props.itemId, false)
    emit('ready', undefined)
})
const removeNavigationGuard = useRouter().beforeEach(() => operation.value === null)
onScopeDispose(removeNavigationGuard)
const baseline: Record<string, unknown> = structuredClone(toRaw(form.state.values))
watch(
    () => props.plan.values,
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
const conflict = computed(() => error.value?.data?.code === 'SITE_ADMIN_CONFLICT')
const busy = computed(() => props.pending || writing.value || status.value === 'pending')
async function submit() {
    if (!operation.value && status.value !== 'pending' && !conflict.value) await form.handleSubmit()
}
onMounted(() => emit('ready', submit))
const descriptors = computed(() =>
    Object.fromEntries(fields.value.map((field) => [field.key, field])),
)
const visiblePlan = computed(() =>
    full.value
        ? {
              ...props.plan,
              visibleFields: props.plan.fields.map((field) => field.key),
          }
        : props.plan,
)
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
