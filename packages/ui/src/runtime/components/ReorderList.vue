<script lang="ts">
import { createChange, createReorder, definePrimitive } from '@ui-sdk/core'
import type { ReorderDraft } from '@ui-sdk/core'
import { usePrimitive } from '@ui-sdk/vue/primitive'
import { computed, nextTick, useId, watch } from 'vue'
import type { VNode } from 'vue'

import { UIcon } from '#components'

import { useUiIcons } from '../composables/icons'

type ReorderOptions = {
    value: Array<string>
    disabled: boolean
    label: (id: string) => string
    onValueChange: (order: Array<string>) => void
}

const reorderList = definePrimitive({
    name: 'reorder-list',
    options: { value: 'list', disabled: 'boolean', label: 'callback', onValueChange: 'callback' },
    state: (options: ReorderOptions) => ({
        value: options.value,
        moving: null as ReorderDraft | null,
    }),
    sync: (options) => ({ value: options.value }),
    controlled: ['value'],
    api(context) {
        const change = createChange(context)
        return {
            reorder: createReorder(context, {
                slot: 'item',
                key: 'value',
                draft: 'moving',
                set: (value, details) => change('value', value, details),
                disabled: () => context.options().disabled,
                label: (id) => context.options().label(id),
                preview: true,
            }),
        }
    },
    slots: (slot) => ({
        item: slot<{ value: string }>({
            props: { value: 'string' },
            bind: (element, part) => part.api.reorder.bind(element, part),
        }),
    }),
})
</script>

<script setup lang="ts" generic="T extends { id: string }">
const value = defineModel<Array<string>>({ required: true })
const props = defineProps<{
    items: Array<T>
    active: boolean
    disabled: boolean
    label: (item: T) => string
}>()
defineSlots<{ default: (props: { item: T }) => Array<VNode> }>()

const instructionsId = useId()
const icons = useUiIcons()
const itemsById = computed(() => new Map(props.items.map((item) => [item.id, item])))
const handle = usePrimitive(reorderList, () => ({
    value: value.value,
    disabled: !props.active || props.disabled,
    label: (id) => {
        const item = itemsById.value.get(id)
        return item ? props.label(item) : id
    },
    onValueChange: (order) => {
        value.value = order
    },
}))
const orderedItems = computed(() =>
    handle.api.reorder.order(handle.state).flatMap((id) => {
        const item = itemsById.value.get(id)
        return item ? [item] : []
    }),
)
const moving = computed(() => handle.state.moving)

watch(
    () => !props.active || props.disabled,
    (disabled) => {
        if (disabled) handle.api.reorder.cancel()
    },
)

async function move(event: MouseEvent, id: string, index: number) {
    if (props.disabled || moving.value || index < 0 || index >= orderedItems.value.length) return

    const button = event.currentTarget as HTMLButtonElement
    const hadFocus = button === document.activeElement
    if (handle.api.reorder.move(id, index) && hadFocus) {
        await nextTick()
        if (button.isConnected && document.activeElement === document.body)
            button.focus({ preventScroll: true })
    }
}
</script>

<template>
    <p v-if="active" :id="instructionsId" class="ui-visually-hidden">
        Press Space or Enter to pick up an item. Use the arrow keys to move it, Space or Enter to
        drop it, and Escape to cancel.
    </p>
    <ul class="ui-reorder-list" role="list">
        <li
            v-for="(item, index) in orderedItems"
            :key="item.id"
            v-bind="handle.slot('item', { value: item.id })"
            :data-item-id="item.id"
            class="ui-reorder-item"
        >
            <div v-if="active" class="ui-reorder-controls">
                <button
                    type="button"
                    class="ui-reorder-control ui-reorder-handle"
                    :aria-label="`Reorder ${label(item)}`"
                    :aria-describedby="instructionsId"
                    :aria-pressed="moving?.key === item.id"
                    :disabled="disabled"
                    @pointerdown="handle.api.reorder.pointerdown($event, item.id)"
                    @keydown="handle.api.reorder.keydown($event, item.id)"
                >
                    <UIcon :name="icons.drag" class="ui-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    class="ui-reorder-control"
                    data-direction="up"
                    :aria-label="`Move ${label(item)} up`"
                    :aria-disabled="disabled || !!moving || index === 0"
                    @click="move($event, item.id, index - 1)"
                >
                    <UIcon :name="icons.arrowUp" class="ui-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    class="ui-reorder-control"
                    data-direction="down"
                    :aria-label="`Move ${label(item)} down`"
                    :aria-disabled="disabled || !!moving || index === orderedItems.length - 1"
                    @click="move($event, item.id, index + 1)"
                >
                    <UIcon :name="icons.arrowDown" class="ui-icon" aria-hidden="true" />
                </button>
            </div>
            <div class="ui-reorder-content">
                <slot :item="item" />
            </div>
        </li>
    </ul>
</template>
