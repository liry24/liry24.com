<script setup lang="ts">
import { FieldControl } from '@ui-sdk/vue/field'

import { UIcon } from '#components'

import { useUiIcons } from '../composables/icons'

const model = defineModel<string>({ required: true })
const { options, placeholder, disabled, name } = defineProps<{
    options: Array<{ value: string; label: string }>
    placeholder?: string
    disabled?: boolean
    name?: string
}>()
const icons = useUiIcons()
</script>

<template>
    <div class="ui-select">
        <FieldControl :disabled="disabled">
            <template #render="{ props: fieldProps }">
                <select
                    v-bind="fieldProps"
                    v-model="model"
                    :name="name"
                    class="ui-input ui-select-control"
                >
                    <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
                    <option v-for="option in options" :key="option.value" :value="option.value">
                        {{ option.label }}
                    </option>
                </select>
            </template>
        </FieldControl>
        <UIcon :name="icons.chevronDown" class="ui-icon ui-select-chevron" aria-hidden="true" />
    </div>
</template>
