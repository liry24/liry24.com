<script setup lang="ts">
const { signOut, user } = useAppSession()
</script>

<template>
    <AdminResourcePage title="Settings" icon="mingcute:settings-1-fill">
        <template #actions>
            <UButton
                label="Logout"
                icon="mingcute:exit-line"
                variant="outline"
                color="neutral"
                @click="signOut()"
            />
        </template>

        <UCard :ui="{ body: 'flex flex-col gap-6 items-start' }" class="divide-none">
            <h2 class="text-title">Account</h2>

            <UUser
                :name="user?.name"
                :avatar="{ src: user?.image || undefined, icon: 'mingcute:user-3-fill' }"
                :ui="{ description: 'flex items-center gap-1' }"
            >
                <template #description>
                    <span>{{ user?.email }}</span>
                    <UBadge
                        v-if="user?.emailVerified"
                        label="Verified"
                        icon="mingcute:check-line"
                        variant="soft"
                        color="success"
                        class="text-green-800 dark:text-green-300"
                        size="sm"
                    />
                </template>
            </UUser>
        </UCard>

        <section id="sessions"><AdminSettingsSessions /></section>
    </AdminResourcePage>
</template>
