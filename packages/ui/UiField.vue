<script setup lang="ts">
import { Field, FieldDescription, FieldError, FieldLabel } from '@ui-sdk/vue/field'

defineProps<{ label: string; error?: string; description?: string; required?: boolean }>()
</script>

<template>
    <Field class="ui-field" :invalid="Boolean(error)" :required="required">
        <FieldLabel class="ui-label">{{ label }}</FieldLabel>
        <FieldDescription v-if="description" class="ui-description">{{
            description
        }}</FieldDescription>
        <slot />
        <FieldError v-if="error" class="ui-error">{{ error }}</FieldError>
    </Field>
</template>
