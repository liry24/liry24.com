<script setup lang="ts">
import { FieldControl } from '@ui-sdk/vue/field'

const model = defineModel<string>({ required: true })
const { options, placeholder, disabled } = defineProps<{
    options: Array<{ value: string; label: string }>
    placeholder?: string
    disabled?: boolean
}>()
</script>

<template>
    <FieldControl :disabled="disabled">
        <template #render="{ props: fieldProps }">
            <select v-bind="fieldProps" v-model="model" class="ui-input">
                <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
                <option v-for="option in options" :key="option.value" :value="option.value">
                    {{ option.label }}
                </option>
            </select>
        </template>
    </FieldControl>
</template>
