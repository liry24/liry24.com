<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const { item } = defineProps<{
    item: PortfolioItem<'arts'>
}>()

const historyStateAdded = ref(false)
let returnFocus: FocusableElement | null = null
const restoreFocus = (event: Event) => {
    if (returnFocus?.isConnected) {
        event.preventDefault()
        returnFocus.focus()
    }
}

const onPopState = () => {
    if (open.value) {
        historyStateAdded.value = false
        open.value = false
    }
}

watch(
    open,
    (val) => {
        if (import.meta.client) {
            if (val) {
                returnFocus = captureActiveFocus()
                history.pushState(null, '')
                historyStateAdded.value = true
                window.addEventListener('popstate', onPopState)
            } else {
                window.removeEventListener('popstate', onPopState)
                if (historyStateAdded.value) {
                    history.back()
                    historyStateAdded.value = false
                }
            }
        }
    },
    { immediate: true },
)

onUnmounted(() => {
    if (import.meta.client) window.removeEventListener('popstate', onPopState)
})
</script>

<template>
    <UModal
        v-model:open="open"
        scrollable
        :title="item.data.title"
        :content="{ onCloseAutoFocus: restoreFocus }"
        :ui="{
            content: 'max-w-full h-[calc(100dvh-4rem)] w-[calc(100dvw-4rem)] rounded-2xl',
        }"
    >
        <slot />

        <template #content>
            <div class="grid gap-6 p-4 md:grid-cols-3 md:gap-12 md:p-16">
                <div class="flex h-full min-w-0 flex-col gap-4 md:col-span-2">
                    <ArtCarousel :data="item.data.images" />
                </div>

                <div class="flex min-w-0 flex-col gap-4">
                    <div class="flex items-start justify-between gap-2">
                        <h1 class="min-w-0 text-2xl font-bold wrap-break-word md:text-4xl">
                            {{ item.data.title }}
                        </h1>

                        <UButton
                            aria-label="Close"
                            icon="mingcute:close-fill"
                            variant="ghost"
                            size="lg"
                            class="ml-auto shrink-0"
                            @click="open = false"
                        />
                    </div>
                    <p>{{ item.data.description }}</p>
                </div>
            </div>
        </template>
    </UModal>
</template>
