<script setup lang="ts">
const { open } = useAdminComposer()

const placeholderItems: Record<string, { id: string; label: string; icon: string }[]> = {
    socials: [
        { id: 'twitter', label: 'Twitter', icon: 'simple-icons:twitter' },
        { id: 'discord', label: 'Discord', icon: 'simple-icons:discord' },
        { id: 'github', label: 'GitHub', icon: 'simple-icons:github' },
    ],
}

useHead({ title: 'Data' })
</script>

<template>
    <div class="h-full min-w-0">
        <UDashboardPanel
            id="data"
            :ui="{
                root: 'h-full min-h-0',
                body: 'gap-4 p-4 sm:gap-4 sm:p-6 *:shrink-0',
            }"
        >
            <template #body>
                <div class="flex flex-col items-center gap-24 pt-[calc(50vh-6rem)]">
                    <div class="flex w-full flex-col items-center gap-8">
                        <AdminComposerPanel v-if="!open" class="mx-auto w-full max-w-xl" />
                    </div>

                    <div
                        v-if="!Object.values(placeholderItems).flat().length"
                        class="relative flex w-full max-w-xl flex-col items-center"
                    >
                        <HairlineRiffle />
                        <p
                            class="text-dimmed absolute inset-x-0 bottom-4 text-center text-sm font-light"
                        >
                            Still nothing here
                        </p>
                    </div>

                    <UContainer v-else class="flex w-fit flex-col gap-12 pt-12">
                        <div class="flex w-full flex-col items-start gap-4">
                            <h2 class="text-sm">Socials</h2>

                            <UScrollArea
                                orientation="horizontal"
                                :ui="{ viewport: 'gap-2' }"
                                class="w-full"
                            >
                                <div
                                    v-for="item in placeholderItems.socials"
                                    class="bg-muted/60 border-muted/30 hover:border-muted/60 flex cursor-grab flex-col gap-1 rounded-xl border px-6.5 py-5 text-sm transition"
                                >
                                    <div class="flex items-center gap-2">
                                        <Icon :name="item.icon" />
                                        <p>{{ item.label }}</p>
                                    </div>
                                    <p class="text-dimmed text-xs">
                                        {{ item.id }}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    aria-label="Add new social"
                                    class="border-muted/70 hover:bg-muted/50 flex w-24 cursor-pointer items-center justify-center gap-1 rounded-xl border-2 border-dashed p-6 text-sm transition-colors"
                                >
                                    <Icon name="mingcute:add-line" class="text-muted" />
                                </button>
                            </UScrollArea>
                        </div>
                    </UContainer>
                </div>
            </template>
        </UDashboardPanel>
    </div>
</template>
