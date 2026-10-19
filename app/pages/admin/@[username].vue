<script setup lang="ts">
const route = useRoute()
const username = route.params.username

useHead({ title: `${username}` })
</script>

<template>
    <div class="h-full min-w-0">
        <UDashboardPanel
            id="users"
            :ui="{
                root: 'h-full min-h-0',
                body: 'gap-4 p-4 sm:gap-4 sm:p-6 *:shrink-0',
            }"
        >
            <template #header>
                <UDashboardNavbar>
                    <template #left>
                        <UBreadcrumb
                            :items="[
                                {
                                    label: 'Users',
                                    to: '/admin/users',
                                },
                                {
                                    label: username,
                                    to: `/admin/@${username}`,
                                },
                            ]"
                        />
                    </template>
                </UDashboardNavbar>
            </template>

            <template #body>
                <div class="flex w-full flex-col items-center gap-24"></div>
            </template>
        </UDashboardPanel>
    </div>
</template>
