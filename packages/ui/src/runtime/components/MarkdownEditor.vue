<script setup lang="ts">
import type { TokenCodec } from '@ui-sdk/vue/token-input'
import type { TriggerDefinition, TriggerMenuSelectDetails } from '@ui-sdk/vue/trigger-menu'
import { computed } from 'vue'

import {
    applyMarkdownSlashCommand,
    createMarkdownSlashCommands,
    markdownDirectTriggers,
} from '../utils/markdown'
import UiSlashEditor from './SlashEditor.vue'

const {
    placeholder = 'Write Markdown…',
    compact = false,
    includeMore = false,
    disabled = false,
    required = false,
} = defineProps<{
    placeholder?: string
    compact?: boolean
    includeMore?: boolean
    disabled?: boolean
    required?: boolean
}>()

const model = defineModel<string>({ required: true })

const codec: TokenCodec = {
    parse: (text) => (text ? [text] : []),
    format: (token) => token.value,
}

const triggers = computed<Array<TriggerDefinition>>(() => [
    ...markdownDirectTriggers,
    {
        char: '/',
        items: createMarkdownSlashCommands({ includeMore }),
    },
])

const onSelect = (value: string, details: TriggerMenuSelectDetails, precedingLine: string) => {
    if (!applyMarkdownSlashCommand(value, details, precedingLine)) details.preventDefault()
}
</script>

<template>
    <UiSlashEditor
        v-model="model"
        :codec="codec"
        :triggers="triggers"
        :placeholder="placeholder"
        multiline
        :compact="compact"
        :disabled="disabled"
        :required="required"
        :on-select="onSelect"
    />
</template>
