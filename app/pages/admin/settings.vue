<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })
const { user } = useUserSession()
const isPreview = String(useRuntimeConfig().public.preview) === 'true'
const failure = ref('')
async function revokeOthers() {
    const client = useAuthClient()
    if (!client) return
    const result = await client.revokeOtherSessions()
    failure.value = result.error?.message || ''
}
</script>

<template>
    <AdminResourcePage title="Settings" icon="mingcute:settings-1-fill">
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
        <section id="sessions">
            <UCard>
                <template #header
                    ><h2 class="my-2 text-xl leading-none font-semibold">Sessions</h2></template
                >
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
                        loading-auto
                        class="ml-auto w-fit min-w-48"
                        @click="revokeOthers"
                    />
                </UPageCard>
            </UCard>
        </section>
        <UAlert v-if="failure" :title="failure" color="error" />
    </AdminResourcePage>
</template>
