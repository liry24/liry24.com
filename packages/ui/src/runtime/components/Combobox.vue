<script setup lang="ts" generic="T extends { value: string; label: string }">
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
} from '@ui-sdk/vue/combobox'
import { computed, ref, useId, watch } from 'vue'
import type { VNode } from 'vue'

import { UIcon } from '#components'

import { useUiIcons } from '../composables/icons'

const props = defineProps<{
    items: Array<T>
    value?: string
    displayLabel?: string
    loading?: boolean
    disabled?: boolean
    invalid?: boolean
    placeholder?: string
    name?: string
    emptyText?: string
    loadingText?: string
    triggerLabel?: string
}>()
const emit = defineEmits<{
    select: [value: string]
    'query-change': [query: string]
    'open-change': [open: boolean]
}>()
defineSlots<{
    item?: (props: { item: T }) => Array<VNode>
    footer?: () => Array<VNode>
}>()

const controlId = useId()
const icons = useUiIcons()
const open = ref(false)
const query = ref(props.displayLabel ?? '')
const comboboxItems = computed(() =>
    props.items.map((item) => ({ value: item.value, label: item.label })),
)

watch(
    () => props.displayLabel,
    (label) => {
        if (!open.value) query.value = label ?? ''
    },
)

function handleOpenChange(next: boolean) {
    open.value = next
    emit('open-change', next)
    if (next) {
        const effective = query.value === (props.displayLabel ?? '') ? '' : query.value
        emit('query-change', effective)
    } else query.value = props.displayLabel ?? ''
}

function handleQueryChange(next: string) {
    query.value = next
    if (!open.value && next !== (props.displayLabel ?? '')) {
        open.value = true
        emit('open-change', true)
    }
    emit('query-change', next)
}

function handleValueChange(next: unknown) {
    if (typeof next !== 'string' || !next) return
    emit('select', next)
    open.value = false
    emit('open-change', false)
}
</script>

<template>
    <Combobox
        :open="open"
        :query="query"
        :value="value ?? ''"
        :items="comboboxItems"
        :status="loading ? 'loading' : 'idle'"
        :filter="false"
        :disabled="disabled"
        :auto-highlight="true"
        @open-change="handleOpenChange"
        @query-change="handleQueryChange"
        @value-change="handleValueChange"
    >
        <div
            :id="controlId"
            class="ui-input ui-combobox-control"
            :aria-disabled="disabled || undefined"
        >
            <ComboboxInput
                :name="name"
                class="ui-combobox-input"
                :placeholder="placeholder ?? 'Search…'"
                :aria-invalid="invalid || undefined"
                autocomplete="off"
            />
            <ComboboxTrigger
                type="button"
                class="ui-token-remove"
                :aria-label="triggerLabel ?? 'Toggle options'"
            >
                <UIcon :name="icons.chevronDown" class="ui-icon ui-icon-xs" aria-hidden="true" />
            </ComboboxTrigger>
        </div>
        <ComboboxContent
            :anchor="`#${controlId}`"
            :side-offset="4"
            class="ui-search-picker-results ui-combobox-results"
        >
            <p v-if="loading" role="status" class="ui-command-message">
                {{ loadingText ?? 'Searching…' }}
            </p>
            <ComboboxList class="ui-search-picker-list">
                <ComboboxItem
                    v-for="item in items"
                    :key="item.value"
                    :value="item.value"
                    :label="item.label"
                    class="ui-search-picker-item"
                >
                    <slot name="item" :item="item">{{ item.label }}</slot>
                </ComboboxItem>
            </ComboboxList>
            <ComboboxEmpty v-if="!loading" class="ui-command-message">
                {{ emptyText ?? 'No results found.' }}
            </ComboboxEmpty>
            <slot name="footer" />
        </ComboboxContent>
    </Combobox>
</template>
