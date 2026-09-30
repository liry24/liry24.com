<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })
const { user } = useUserSession()
const failure = ref('')
async function revokeOthers() {
    const client = useAuthClient()
    if (!client) return
    const result = await client.revokeOtherSessions()
    failure.value = result.error?.message || ''
}
</script>

<template>
    <AdminResourcePage title="Settings">
        <p>{{ user?.email }}</p>
        <AdminSettingsPasskeys />
        <AdminSettingsAccounts />
        <UButton label="Logout other sessions" @click="revokeOthers" />
        <UAlert v-if="failure" :title="failure" color="error" />
    </AdminResourcePage>
</template>
