<script setup lang="ts">
interface Props {
    src: string
    alt?: string
}
const { src, alt } = defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })
let returnFocus: HTMLElement | null = null
watch(
    open,
    (value) => {
        if (value && import.meta.client)
            returnFocus =
                document.activeElement instanceof HTMLElement ? document.activeElement : null
    },
    { immediate: true },
)
const restoreFocus = (event: Event) => {
    if (returnFocus?.isConnected) {
        event.preventDefault()
        returnFocus.focus()
    }
}
</script>

<template>
    <UModal
        v-model:open="open"
        fullscreen
        :title="alt || 'Image preview'"
        :content="{ onCloseAutoFocus: restoreFocus }"
        :ui="{ content: 'bg-transparent' }"
    >
        <template #content>
            <button
                type="button"
                aria-label="Close image preview"
                class="size-full focus-visible:outline-2 focus-visible:outline-offset-[-4px]"
                @click="open = false"
            >
                <img :src :alt class="size-full max-h-full max-w-full object-contain" />
            </button>
        </template>
    </UModal>
</template>
