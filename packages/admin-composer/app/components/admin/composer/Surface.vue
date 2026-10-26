<script setup lang="ts">
const { plan } = defineProps<{ plan: ComposerPlan }>()
</script>

<template>
    <div class="grid min-w-0 gap-5">
        <template v-if="plan.intent === 'create' || plan.intent === 'edit'">
            <template v-for="field in plan.fields" :key="field.key">
                <slot
                    v-if="plan.visibleFields.includes(field.key)"
                    name="field"
                    :field-name="field.key"
                />
            </template>
            <slot
                v-if="plan.model === 'posts' && plan.datePurpose === 'publication'"
                name="schedule"
            />
            <slot name="action" />
        </template>
        <slot v-else-if="plan.intent === 'settings'" name="action" />
        <template v-else-if="plan.intent !== 'clarify'">
            <slot v-if="plan.intent === 'search'" name="results" />
            <slot v-if="plan.model" name="action" />
        </template>
    </div>
</template>
