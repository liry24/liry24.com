<script setup lang="ts">
interface Props {
    src: string
    alt?: string
}
const { src, alt } = defineProps<Props>()

const appConfig = useAppConfig()
const open = defineModel<boolean>('open', { default: false })
let returnFocus: FocusableElement | null = null
watch(
    open,
    (value) => {
        if (value && import.meta.client) returnFocus = captureActiveFocus()
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
        :ui="{ content: 'bg-black/92 backdrop-blur-xs divide-y-0' }"
    >
        <template #content>
            <div class="relative flex size-full items-center justify-center p-4 sm:p-10">
                <button
                    type="button"
                    aria-label="Close image preview"
                    class="fixed top-4 right-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-zinc-900/90 text-white ring-1 ring-white/20 transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    @click="open = false"
                >
                    <UIcon :name="appConfig.ui.icons.close" class="size-5" aria-hidden="true" />
                </button>
                <img
                    :src="src"
                    :alt="alt || ''"
                    class="max-h-full max-w-full cursor-zoom-out rounded-lg object-contain"
                    @click="open = false"
                />
            </div>
        </template>
    </UModal>
</template>
