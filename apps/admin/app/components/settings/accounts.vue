<script setup lang="ts">
const accounts = ref<{ providerId: string }[]>([])

const config = useRuntimeConfig()
const toast = useToast()
const { client, refreshSession } = useAuth()

const list = [
    {
        providerId: 'github',
        name: 'GitHub',
        icon: 'simple-icons:github',
    },
    {
        providerId: 'vercel',
        name: 'Vercel',
        icon: 'simple-icons:vercel',
    },
]

const unlink = async (providerId: string) => {
    try {
        await refreshSession()
        const { error } = await client.unlinkAccount({
            providerId,
        })
        if (error) throw error
        accounts.value = (await client.listAccounts()).data || []

        toast.add({
            icon: 'lucide:check',
            title: 'Account unlinked successfully',
            color: 'success',
        })
    } catch (error) {
        console.error(error)
        toast.add({
            icon: 'lucide:x',
            title: 'Failed to unlink account',
            color: 'error',
        })
    }
}

onMounted(async () => {
    accounts.value = (await client.listAccounts()).data || []
})
</script>

<template>
    <UCard>
        <template #header>
            <h2 class="my-2 text-xl leading-none font-semibold text-nowrap">Social Accounts</h2>
        </template>

        <div class="mx-auto flex w-fit flex-col gap-6">
            <UPageCard
                v-for="item in list"
                :key="item.providerId"
                orientation="horizontal"
                variant="naked"
            >
                <template #title>
                    <div class="flex items-center gap-3">
                        <Icon :name="item.icon" size="28" />
                        <span class="pt-px text-lg">{{ item.name }}</span>
                    </div>
                </template>

                <UButton
                    v-if="accounts?.find((account) => account.providerId === item.providerId)"
                    label="Unlink"
                    variant="subtle"
                    color="error"
                    block
                    class="ml-auto w-fit min-w-48"
                    @click="unlink(item.providerId)"
                />
                <UButton
                    v-else
                    label="Link"
                    variant="subtle"
                    color="neutral"
                    block
                    class="ml-auto w-fit min-w-48"
                    @click="
                        client.linkSocial({
                            provider: item.providerId,
                            callbackURL: `${config.public.adminDomain}/settings#accounts`,
                        })
                    "
                />
            </UPageCard>
        </div>
    </UCard>
</template>
