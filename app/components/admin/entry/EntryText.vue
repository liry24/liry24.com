<script setup lang="ts">
import { UiButton, UiField, UiInput, UiTextarea } from '@liry24/ui'

const model = defineModel<string | undefined>()
defineProps<{
    label: string
    name: string
    error?: string
    required?: boolean
    description?: string
    placeholder?: string
    type?: 'text' | 'url'
    multiline?: boolean
    suggestion?: string
}>()
</script>

<template>
    <UiField :label="label" :error="error" :required="required" :description="description">
        <UiTextarea
            v-if="multiline"
            :name="name"
            :model-value="model ?? ''"
            :required="required"
            :placeholder="placeholder"
            :rows="3"
            class="ui-input resize-y"
            @update:model-value="model = $event"
        />
        <UiInput
            v-else
            :name="name"
            :model-value="model ?? ''"
            :required="required"
            :placeholder="placeholder"
            :type="type ?? 'text'"
            class="ui-input"
            @update:model-value="model = $event"
        />
        <UiButton
            v-if="suggestion && model !== suggestion"
            type="button"
            class="ui-button w-fit max-w-full text-start break-all"
            data-variant="ghost"
            @click="model = suggestion"
        >
            Use {{ suggestion }}
        </UiButton>
    </UiField>
</template>
