<script setup lang="ts">
const model = defineModel<string | undefined>()
defineProps<{ error?: string; required?: boolean }>()
defineEmits<{ search: [event: MouseEvent] }>()
</script>

<template>
    <UiField label="Icon" :error="error" :required="required">
        <div class="flex flex-wrap items-center gap-2">
            <Icon v-if="model" :name="model" class="shrink-0 text-lg" aria-hidden="true" />
            <UiInput
                :model-value="model ?? ''"
                name="data.icon"
                :required="required"
                placeholder="lucide:link"
                class="min-w-28 flex-1 font-mono"
                @update:model-value="model = $event"
            />
            <UiButton class="shrink-0" @click="$emit('search', $event)">
                <Icon name="mingcute:search-line" aria-hidden="true" />
                Find icon
            </UiButton>
        </div>
    </UiField>
</template>
