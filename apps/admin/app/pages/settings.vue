<script setup lang="ts">
const { session } = useAuth()
</script>

<template>
    <div v-if="session" class="px-6">
        <UDashboardPanel resizable>
            <template #header>
                <UDashboardNavbar
                    title="Settings"
                    icon="mingcute:settings-1-fill"
                    class="lg:not-last:border-0"
                />
            </template>

            <template #body>
                <div class="flex flex-col gap-4 p-2">
                    <section id="email">
                        <SettingsEmail :session />
                    </section>

                    <section id="social" class="empty:hidden">
                        <SettingsAccounts />
                    </section>

                    <section id="sessions">
                        <UCard>
                            <template #header>
                                <h2 class="my-2 text-xl leading-none font-semibold text-nowrap">
                                    Sessions
                                </h2>
                            </template>

                            <div class="flex w-full flex-col gap-6">
                                <UPageCard
                                    title="Logout Other Sessions"
                                    description="Logout all other sessions."
                                    orientation="horizontal"
                                    variant="naked"
                                >
                                    <UButton
                                        label="Logout Other Sessions"
                                        variant="subtle"
                                        color="neutral"
                                        block
                                        class="ml-auto w-fit min-w-48"
                                        @click="authClient.revokeOtherSessions()"
                                    />
                                </UPageCard>
                            </div>
                        </UCard>
                    </section>

                    <UCard variant="soft">
                        <template #header>
                            <h2 class="my-2 text-xl leading-none font-semibold text-nowrap">
                                DANGER ZONE
                            </h2>
                        </template>

                        <UPageCard
                            title="Delete Account"
                            description="Deletes the account and all associated data. Deleted accounts cannot be restored."
                            orientation="horizontal"
                            variant="naked"
                        >
                            <UModal title="Delete Account">
                                <UButton
                                    label="Delete Account"
                                    variant="subtle"
                                    color="error"
                                    block
                                    class="ml-auto w-fit min-w-48"
                                />

                                <template #body>
                                    <UAlert
                                        icon="lucide:trash"
                                        title="Are you sure you want to delete your account?"
                                        description="This action cannot be undone."
                                        color="error"
                                        variant="subtle"
                                    />
                                </template>

                                <template #footer>
                                    <div class="flex w-full items-center justify-end gap-2">
                                        <UButton label="Cancel" variant="ghost" />
                                        <UButton label="Delete" color="error" variant="solid" />
                                    </div>
                                </template>
                            </UModal>
                        </UPageCard>
                    </UCard>
                </div>
            </template>
        </UDashboardPanel>
    </div>
</template>
