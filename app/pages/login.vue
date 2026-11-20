<script setup lang="ts">
definePageMeta({ layout: 'minimal' })

const toast = useToast()
const route = useRoute()
const { user, load, signOut } = useAppSession()
await load()
if (user.value?.role === 'admin') await navigateTo('/admin')
const signingIn = ref(false)
async function signIn() {
    if (signingIn.value) return
    signingIn.value = true
    try {
        const result = await authClient.signIn.social({
            provider: 'pocket-id',
            callbackURL: '/auth/complete',
            errorCallbackURL: '/login',
        })
        if (result.error) throw result.error
    } catch (error) {
        toast.add({
            title: 'サインインできませんでした',
            description: error instanceof Error ? error.message : 'Please try again.',
            color: 'error',
        })
    } finally {
        signingIn.value = false
    }
}
const error = computed(() => typeof route.query.error === 'string')
</script>

<template>
    <div class="grid grow items-center">
        <div class="mx-auto flex w-full max-w-sm flex-col gap-4">
            <UAlert
                v-if="error"
                title="サインインできませんでした。もう一度お試しください。"
                color="error"
            />
            <template v-if="user">
                <p>{{ user.name }} としてサインインしています。</p>
                <UButton to="/" label="Back to site" />
                <UButton label="Logout" variant="outline" @click="signOut()" />
            </template>
            <UAuthForm
                v-else
                title="Liry24"
                :providers="[
                    {
                        label: 'Pocket ID でサインイン',
                        icon: 'mingcute:key-2-fill',
                        onClick: signIn,
                        loading: signingIn,
                    },
                ]"
                :ui="{ title: 'font-extralight text-4xl' }"
            />
        </div>
    </div>
</template>
