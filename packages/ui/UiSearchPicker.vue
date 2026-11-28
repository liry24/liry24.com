<script setup lang="ts">
import { useAsyncOptions } from '@ui-sdk/vue/async-options'
import { Button } from '@ui-sdk/vue/button'
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '@ui-sdk/vue/combobox'
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle } from '@ui-sdk/vue/dialog'
import { computed, shallowRef, useId, watch } from 'vue'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
    title: string
    label: string
    load: (
        query: string,
        signal: AbortSignal,
        update?: (items: Array<string>) => void,
    ) => Promise<Array<string>>
    finalFocus?: () => HTMLElement | null
    placeholder?: string
    minQueryText?: string
    emptyText?: string
}>()
const emit = defineEmits<{ select: [value: string] }>()
const inputId = useId()
const toItems = (values: Array<string>) => values.map((value) => ({ value, label: value }))
const partialItems = shallowRef<ReturnType<typeof toItems>>([])
const { state, setQuery, reload } = useAsyncOptions(
    async (query, { signal }): Promise<ReturnType<typeof toItems>> => {
        partialItems.value = []
        const items = await props.load(query, signal, (items) => {
            if (
                open.value &&
                !signal.aborted &&
                state.value.query === query &&
                state.value.status === 'loading'
            )
                partialItems.value = toItems(items)
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
    <Dialog v-model:open="open">
        <DialogBackdrop class="ui-dialog-backdrop" />
        <DialogContent
            class="ui-dialog ui-search-picker"
            :initial-focus="`#${inputId}`"
            :final-focus="finalFocus"
        >
            <header class="ui-dialog-header">
                <DialogTitle class="ui-dialog-title">{{ title }}</DialogTitle>
                <DialogClose
                    class="ui-button ui-dialog-close"
                    data-variant="ghost"
                    aria-label="Close search"
                    >×</DialogClose
                >
            </header>
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
                    <ComboboxInput
                        :id="inputId"
                        class="ui-input"
                        type="search"
                        :aria-label="label"
                        :placeholder="placeholder ?? 'Search'"
                    />
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
                <p v-if="state.status === 'loading'" role="status" class="ui-description">
                    Searching…
                </p>
                <div v-else-if="state.status === 'error'" class="ui-search-picker-status">
                    <p role="alert" class="ui-error">Could not load search results.</p>
                    <Button type="button" class="ui-button" @click="reload()">Retry</Button>
                </div>
                <p v-else-if="state.query.trim().length < 2" class="ui-description">
                    {{ minQueryText ?? 'Enter at least two characters.' }}
                </p>
                <p v-else-if="!state.items.length" role="status" class="ui-description">
                    {{ emptyText ?? 'No results found.' }}
                </p>
            </div>
        </DialogContent>
    </Dialog>
</template>
