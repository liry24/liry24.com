<script setup lang="ts">
const { signOut, user, isLocalAdmin } = useAppSession()
useHead({ title: 'Settings' })
</script>

<template>
    <UDashboardPanel
        id="settings"
        :ui="{
            root: 'h-full min-h-0',
            body: 'gap-6 p-4 sm:p-6 *:shrink-0',
        }"
    >
        <template #header>
            <UDashboardNavbar title="Settings" icon="mingcute:settings-1-fill">
                <template #right>
                    <UButton
                        v-if="!isLocalAdmin"
                        label="Sign out"
                        icon="mingcute:exit-line"
                        variant="outline"
                        color="neutral"
                        @click="signOut()"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UCard :ui="{ body: 'flex flex-col gap-4 items-start' }" class="divide-none">
                <h2 class="text-title">Account</h2>

                <UUser
                    :name="user?.name || 'Admin'"
                    :avatar="{
                        src: user?.image || undefined,
                        icon: 'mingcute:user-3-fill',
                    }"
                    :ui="{ description: 'flex items-center gap-2' }"
                >
                    <template #description>
                        <span>{{ user?.email }}</span>
                        <UBadge
                            v-if="user?.emailVerified"
                            label="Verified"
                            icon="mingcute:check-line"
                            variant="soft"
                            color="success"
                            size="sm"
                        />
                    </template>
                </UUser>
            </UCard>

            <section id="sessions">
                <AdminSettingsSessions />
            </section>
        </template>
    </UDashboardPanel>
</template>
