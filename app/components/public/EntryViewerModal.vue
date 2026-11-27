<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const {
    title,
    hasMedia = true,
    sharePath,
    externalHref,
    externalLabel = 'Open link',
} = defineProps<{
    title: string
    hasMedia?: boolean
    sharePath?: string
    externalHref?: string
    externalLabel?: string
}>()

const appConfig = useAppConfig()
const { restoreFocus } = useViewerModal(open)
const { isSupported: isCopySupported, copy, copied } = useClipboard()

const copyShareLink = () => {
    if (!sharePath || !import.meta.client) return
    void copy(new URL(sharePath, window.location.origin).href)
}
</script>

<template>
    <UModal
        v-model:open="open"
        :title="title"
        :content="{ onCloseAutoFocus: restoreFocus }"
        :ui="{
            content: cn(
                'divide-y-0 overflow-hidden rounded-2xl p-0 shadow-2xl',
                hasMedia
                    ? 'max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-6xl sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100vw-3rem)]'
                    : 'max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-xl sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100vw-3rem)]',
            ),
        }"
    >
        <slot name="trigger" />

        <template #content>
            <div
                :class="
                    cn(
                        'grid min-h-0 flex-1 overflow-x-hidden overflow-y-auto',
                        hasMedia &&
                            'lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.9fr)] lg:overflow-hidden',
                    )
                "
            >
                <div
                    v-if="hasMedia && $slots.media"
                    class="bg-muted/45 border-default flex min-w-0 flex-col justify-center border-b p-4 sm:p-6 lg:min-h-0 lg:overflow-y-auto lg:border-e lg:border-b-0 lg:p-8 dark:bg-neutral-950/60"
                >
                    <slot name="media" />
                </div>

                <div class="flex min-h-0 min-w-0 flex-col">
                    <header
                        class="border-default flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6"
                    >
                        <div class="flex min-w-0 flex-1 items-center gap-3">
                            <slot name="leading" />
                            <h2
                                class="text-highlighted min-w-0 text-lg font-semibold tracking-tight wrap-break-word sm:text-xl lg:text-2xl"
                            >
                                {{ title }}
                            </h2>
                        </div>

                        <UButton
                            aria-label="Close"
                            :icon="appConfig.ui.icons.close"
                            variant="ghost"
                            color="neutral"
                            size="md"
                            square
                            class="shrink-0"
                            @click="open = false"
                        />
                    </header>

                    <div
                        class="flex min-h-0 flex-1 flex-col gap-5 px-5 py-5 sm:px-6 lg:overflow-y-auto"
                    >
                        <div v-if="$slots.meta" class="min-w-0">
                            <slot name="meta" />
                        </div>

                        <div v-if="$slots.default" class="min-w-0">
                            <slot />
                        </div>
                    </div>

                    <footer
                        v-if="externalHref || sharePath || $slots['footer-extra']"
                        class="border-default bg-muted/30 flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 sm:px-6"
                    >
                        <div class="flex flex-wrap items-center gap-2">
                            <UButton
                                v-if="externalHref"
                                :to="externalHref"
                                target="_blank"
                                rel="noopener"
                                :label="externalLabel"
                                :trailing-icon="appConfig.ui.icons.external"
                                color="neutral"
                            />
                            <slot name="footer-extra" />
                        </div>

                        <ClientOnly>
                            <UButton
                                v-if="sharePath && isCopySupported"
                                :icon="
                                    copied ? appConfig.ui.icons.copyCheck : appConfig.ui.icons.copy
                                "
                                :label="copied ? 'Copied' : 'Copy link'"
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                class="ms-auto"
                                @click="copyShareLink"
                            />
                        </ClientOnly>
                    </footer>
                </div>
            </div>
        </template>
    </UModal>
</template>
