<script setup lang="ts">
import type { SiteAdminPublicModels } from '@liria24/site-admin/client'

const open = defineModel<boolean>('open', { default: false })

const { item } = defineProps<{
    item: SiteAdminPublicModels['arts']
}>()

const historyStateAdded = ref(false)

const onPopState = () => {
    if (open.value) {
        historyStateAdded.value = false
        open.value = false
    }
}

watch(
    open,
    (val) => {
        if (import.meta.client)
            if (val) {
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
        :ui="{
            content: 'max-w-full h-[calc(100dvh-4rem)] w-[calc(100dvw-4rem)] rounded-2xl',
        }"
    >
        <slot />

        <template #content>
            <div class="grid grid-cols-3 gap-12 p-16">
                <div class="col-span-2 flex h-full flex-col gap-4">
                    <ArtCarousel :data="item.data.images" />
                </div>

                <div class="flex flex-col gap-4">
                    <div class="flex items-start justify-between gap-2">
                        <h1 class="text-4xl font-bold">{{ item.data.title }}</h1>

                        <UButton
                            aria-label="Close"
                            icon="mingcute:close-fill"
                            variant="ghost"
                            size="lg"
                            class="ml-auto"
                            @click="open = false"
                        />
                    </div>
                    <p>{{ item.data.description }}</p>
                </div>
            </div>
        </template>
    </UModal>
</template>
