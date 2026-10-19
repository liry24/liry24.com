<script setup lang="ts">
const { signOut, user } = useUserSession()

const isPreview = String(useRuntimeConfig().public.preview) === 'true'
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

        <UCard>
            <template #header>
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h2 class="my-2 text-xl leading-none font-semibold">Account</h2>
                    <UBadge
                        v-if="user?.emailVerified"
                        label="Email verified"
                        icon="mingcute:check-line"
                        variant="soft"
                        color="success"
                    />
                </div>
            </template>
            <UUser
                :name="user?.name"
                :description="user?.email"
                :avatar="{ src: user?.image || undefined, icon: 'mingcute:user-3-fill' }"
            />
        </UCard>
        <section v-if="!isPreview" id="passkeys"><AdminSettingsPasskeys /></section>
        <section id="accounts"><AdminSettingsAccounts /></section>
        <section id="sessions"><AdminSettingsSessions /></section>
    </AdminResourcePage>
</template>
