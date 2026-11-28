<script setup lang="ts">
import { useAsyncOptions } from '@ui-sdk/vue/async-options'
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '@ui-sdk/vue/combobox'
import { computed, shallowRef, useId, watch } from 'vue'

import { UIcon } from '#components'

import { useUiIcons } from '../composables/icons'
import type { DialogFinalFocus } from '../types'
import UiButton from './Button.vue'
import UiDialog from './Dialog.vue'

const open = defineModel<boolean>('open', { required: true })
const { title, label, load, finalFocus, placeholder, minQueryText, emptyText } = defineProps<{
    title: string
    label: string
    load: (
        query: string,
        signal: AbortSignal,
        update?: (items: Array<string>) => void,
    ) => Promise<Array<string>>
    finalFocus?: DialogFinalFocus
    placeholder?: string
    minQueryText?: string
    emptyText?: string
}>()
const emit = defineEmits<{ select: [value: string] }>()

const inputId = useId()
const icons = useUiIcons()
const toItems = (values: Array<string>) => values.map((value) => ({ value, label: value }))
const partialItems = shallowRef<ReturnType<typeof toItems>>([])
const { state, setQuery, reload } = useAsyncOptions(
    async (query, { signal }): Promise<ReturnType<typeof toItems>> => {
        partialItems.value = []
        const items = await load(query, signal, (next) => {
            if (
                open.value &&
                !signal.aborted &&
                state.value.query === query &&
                state.value.status === 'loading'
            )
                partialItems.value = toItems(next)
        })
        return toItems(items)
    },
    { debounce: 280, minLength: 2 },
)
const visibleItems = computed(() => {
    if (state.value.status === 'loading') return partialItems.value
    return state.value.status === 'idle' ? state.value.items : []
})

watch(
    open,
    (value) => {
        if (!value) {
            partialItems.value = []
            setQuery('')
        }
    },
    { flush: 'sync' },
)

function search(query: string) {
    if (!open.value) return
    if (query !== state.value.query) partialItems.value = []
    setQuery(query)
}

function select(value: unknown) {
    if (typeof value !== 'string' || !value) return
    emit('select', value)
    open.value = false
}
</script>

<template>
    <UiDialog
        v-model:open="open"
        :title="title"
        size="sm"
        overflow="visible"
        close-label="Close search"
        :initial-focus="`#${inputId}`"
        :final-focus="finalFocus"
    >
        <div class="ui-search-picker-body">
            <Combobox
                :items="visibleItems"
                :query="state.query"
                :status="state.status"
                :filter="false"
                :auto-highlight="true"
                @query-change="search"
                @value-change="select"
            >
                <div class="ui-search-picker-field">
                    <UIcon
                        :name="icons.search"
                        class="ui-icon ui-search-picker-icon"
                        aria-hidden="true"
                    />
                    <ComboboxInput
                        :id="inputId"
                        class="ui-input ui-search-picker-input"
                        type="search"
                        :aria-label="label"
                        :placeholder="placeholder ?? 'Search'"
                    />
                </div>
                <ComboboxContent class="ui-search-picker-results">
                    <ComboboxList class="ui-search-picker-list">
                        <ComboboxItem
                            v-for="item in visibleItems"
                            :key="item.value"
                            :value="item.value"
                            :label="item.label"
                            class="ui-search-picker-item"
                        >
                            <slot name="item" :value="item.value">{{ item.label }}</slot>
                        </ComboboxItem>
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
            <p v-if="state.status === 'loading'" role="status" class="ui-description">Searching…</p>
            <div v-else-if="state.status === 'error'" class="ui-search-picker-status">
                <p role="alert" class="ui-error">Could not load search results.</p>
                <UiButton size="sm" @click="reload()">Retry</UiButton>
            </div>
            <p v-else-if="state.query.trim().length < 2" class="ui-description">
                {{ minQueryText ?? 'Enter at least two characters.' }}
            </p>
            <p v-else-if="!state.items.length" role="status" class="ui-description">
                {{ emptyText ?? 'No results found.' }}
            </p>
        </div>
    </UiDialog>
</template>
