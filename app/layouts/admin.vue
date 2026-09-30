<script setup lang="ts">
const { signOut, user } = useUserSession()
const models = ['works', 'arts', 'careers', 'ranks', 'skills', 'socials', 'posts']
</script>

<template>
    <UDashboardGroup>
        <UDashboardSidebar>
            <template #header>
                <NuxtLink to="/admin">Liry24 Admin</NuxtLink>
            </template>

            <UNavigationMenu
                orientation="vertical"
                :items="models.map((name) => ({ label: name, to: `/admin/${name}` }))"
            />
            <template #footer>
                <div class="grid gap-3">
                    <span>{{ user?.name }}</span>
                    <NuxtLink to="/admin/settings">Settings</NuxtLink>
                    <UButton label="Sign out" @click="() => signOut()" /><NuxtLink to="/">
                        Back to site
                    </NuxtLink>
                </div>
            </template>
        </UDashboardSidebar>

        <main class="min-w-0 flex-1">
            <slot />
        </main>
    </UDashboardGroup>
</template>
