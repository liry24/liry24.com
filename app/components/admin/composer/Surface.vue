<script setup lang="ts">
import type { Spec } from '@json-render/core'
import { defineRegistry, JSONUIProvider, Renderer } from '@json-render/vue'
import { composerCatalog } from '~~/shared/utils/adminComposer'

defineProps<{ spec: Spec }>()
const slots = useSlots()
const { registry } = defineRegistry(composerCatalog, {
    components: {
        Panel: ({ children }) => h('div', { class: 'grid min-w-0 gap-5' }, children),
        Group: ({ props, children }) =>
            h(
                'div',
                {
                    class:
                        props.columns === 'two'
                            ? 'grid min-w-0 gap-4 sm:grid-cols-2'
                            : 'grid gap-4',
                },
                children,
            ),
        Field: ({ props }) => slots.field?.({ name: props.name }) ?? null,
        Schedule: () => slots.schedule?.() ?? null,
        Results: () => slots.results?.() ?? null,
        Action: ({ props }) => slots.action?.({ kind: props.kind }) ?? null,
    },
})
</script>

<template>
    <JSONUIProvider :registry>
        <Renderer :spec :registry />
    </JSONUIProvider>
</template>
