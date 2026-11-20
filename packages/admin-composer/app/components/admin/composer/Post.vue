<script setup lang="ts">
interface Props {
    plan: ComposerPlan
    pending: boolean
    itemId: string
}
const { plan, pending, itemId } = defineProps<Props>()

const { openPost, preparation } = useAdminComposer()
const { values, publishAt, baseline } = toRefs(preparation(itemId))

watch(
    () => plan,
    (plan) => {
        const changes = composerValueUpdates(
            { ...values.value, publishAt: publishAt.value },
            baseline.value,
            { ...plan.values, publishAt: plan.publishAt },
        )
        for (const [key, value] of Object.entries(changes)) {
            if (key === 'publishAt') publishAt.value = String(value)
            else values.value[key] = value as string | string[]
            baseline.value[key] = value
        }
    },
    { immediate: true },
)
</script>

<template>
    <fieldset :disabled="pending">
        <AdminComposerSurface :plan>
            <template #field="{ fieldName: name }">
                <AdminFormField
                    v-if="plan.fields.find((field) => field.key === name)"
                    :descriptor="plan.fields.find((field) => field.key === name)!"
                    :model-value="values[name]"
                    @update:model-value="(value) => (values[name] = value as string | string[])"
                />
            </template>
            <template #schedule>
                <UFormField
                    label="Publication schedule"
                    :description="
                        'Optional. Review and confirm in the editor. Timezone: ' + plan.timeZone
                    "
                >
                    <UInput
                        v-model="publishAt"
                        type="datetime-local"
                        class="w-full"
                        variant="soft"
                    />
                </UFormField>
            </template>
            <template #action>
                <UButton
                    label="Continue in Post Editor"
                    icon="mingcute:arrow-right-line"
                    color="neutral"
                    size="lg"
                    block
                    :disabled="pending"
                    @click="openPost(itemId, values, publishAt)"
                />
            </template>
        </AdminComposerSurface>
    </fieldset>
</template>
