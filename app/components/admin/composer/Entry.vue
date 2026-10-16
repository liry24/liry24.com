<script setup lang="ts">
import type { Spec } from '@json-render/core'
import { defaultComposerSpec, type ComposerPlan } from '~~/shared/utils/adminComposer'

const props = defineProps<{ plan: ComposerPlan; spec: Spec; pending: boolean }>()
const emit = defineEmits<{ saved: [] }>()
const full = ref(false)
const { open, busy: writing } = useAdminComposer()
const { form, fields, upload, operation, error, status, features, draft } = await useAdminForm(
    String(props.plan.model),
    {
        id: () => props.plan.entryId,
        onSuccess: () => emit('saved'),
    },
)
watch(
    operation,
    (value) => {
        writing.value = value !== null
    },
    { flush: 'sync', immediate: true },
)
onScopeDispose(() => {
    writing.value = false
})
const removeNavigationGuard = useRouter().beforeEach(() => operation.value === null)
onScopeDispose(removeNavigationGuard)
const restored = draft.isDirty.value
if (restored) full.value = true
const baseline: Record<string, unknown> = structuredClone(toRaw(form.state.values))
watch(
    () => props.plan.values,
    (values) => {
        if (restored || operation.value) return
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
const busy = computed(() => props.pending || operation.value !== null || status.value === 'pending')
const descriptors = computed(() =>
    Object.fromEntries(fields.value.map((field) => [field.key, field])),
)
const spec = computed(() => (full.value ? defaultComposerSpec(props.plan) : props.spec))
</script>

<template>
    <form.Subscribe :selector="(state) => ({ saving: state.isSubmitting })" v-slot="{ saving }">
        <form class="grid gap-4" @submit.prevent="!busy && !conflict && form.handleSubmit()">
            <UAlert
                v-if="restored"
                title="Unsaved input restored"
                description="Your existing input is kept. Suggestions have not replaced it."
                color="neutral"
            />
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
                <AdminComposerSurface :spec>
                    <template #field="{ name }">
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
