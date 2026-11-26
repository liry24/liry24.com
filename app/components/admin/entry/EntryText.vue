<script setup lang="ts">
import { UiField, UiInput, UiTextarea } from '@liry24/ui'

const model = defineModel<string | undefined>()
defineProps<{
    label: string
    name: string
    error?: string
    required?: boolean
    description?: string
    placeholder?: string
    type?: 'text' | 'url'
    rows?: number
}>()
</script>

<template>
    <UiField :label="label" :error="error" :required="required" :description="description">
        <UiTextarea
            v-if="rows !== undefined"
            v-model="model"
            :name="name"
            :required="required"
            :placeholder="placeholder"
            :rows="rows"
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
    </UiField>
</template>
