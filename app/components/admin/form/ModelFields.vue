<script setup lang="ts">
import type { AnyVueFormApi } from '@tanstack/vue-form'
defineProps<{
    form: AnyVueFormApi
    fields: ComposerField[]
    disabled?: boolean
    uploading?: boolean
    categories?: string[]
}>()
const emit = defineEmits<{
    upload: [name: string, files: File | File[] | null | undefined, multiple: boolean]
    invalid: [value: boolean]
}>()
const invalid = new Set<string>()
function validity(key: string, value: boolean) {
    if (value) invalid.add(key)
    else invalid.delete(key)
    emit('invalid', invalid.size > 0)
}
</script>
<template>
    <form.Field
        v-for="descriptor in fields"
        :key="descriptor.key"
        :name="`data.${descriptor.key}`"
        v-slot="{ field }"
    >
        <AdminFormField
            :descriptor
            :model-value="field.state.value"
            :errors="field.state.meta.errors"
            :disabled
            :uploading
            :categories
            @update:model-value="field.handleChange"
            @blur="field.handleBlur"
            @upload="emit('upload', descriptor.key, $event, descriptor.kind === 'images')"
            @invalid="validity(descriptor.key, $event)"
        />
    </form.Field>
</template>
