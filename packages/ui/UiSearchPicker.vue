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
import { useId, watch } from 'vue'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
    title: string
    label: string
    load: (query: string, signal: AbortSignal) => Promise<Array<string>>
    finalFocus?: () => HTMLElement | null
    placeholder?: string
    minQueryText?: string
    emptyText?: string
}>()
const emit = defineEmits<{ select: [value: string] }>()
const inputId = useId()
const { state, setQuery, reload } = useAsyncOptions(
    async (query, { signal }) =>
        (await props.load(query, signal)).map((value) => ({ value, label: value })),
    { debounce: 280, minLength: 2 },
)

watch(open, (value) => {
    if (!value) setQuery('')
})

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
                    :items="state.status === 'idle' ? state.items : []"
                    :status="state.status"
                    :filter="false"
                    :auto-highlight="true"
                    @query-change="setQuery"
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
                                v-for="item in state.status === 'idle' ? state.items : []"
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
