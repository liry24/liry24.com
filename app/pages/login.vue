<script setup lang="ts">
definePageMeta({
    layout: 'minimal',
})

useHead({ title: 'Login' })

const route = useRoute()
const toast = useToast()
const signingIn = ref(false)
const { load, isAdmin } = useAppSession()
await load()

const safeRedirect = computed(() => adminRedirect(route.query.redirect))

if (isAdmin.value) {
    await navigateTo(safeRedirect.value, { replace: true })
}

const errorMessage = computed(() => {
    const code = typeof route.query.error === 'string' ? route.query.error : ''
    if (!code) {
        return ''
    }
    if (code === 'forbidden') {
        return 'This account does not have administrator access.'
    }
    return 'Could not sign in with Pocket ID. Please try again.'
})

const signInWithPocketId = async () => {
    if (signingIn.value) {
        return
    }
    signingIn.value = true
    try {
        const result = await authClient.signIn.social({
            provider: 'pocket-id',
            callbackURL: safeRedirect.value,
            errorCallbackURL: `/login?${new URLSearchParams({ error: 'oauth', redirect: safeRedirect.value })}`,
        })
        if (result.error) {
            throw new Error(result.error.message || 'Sign in failed.')
        }
    } catch (error) {
        toast.add({
            title: 'Sign in failed',
            description: Error.isError(error) ? error.message : 'Please try again.',
            color: 'error',
        })
    } finally {
        signingIn.value = false
    }
}
</script>

<template>
    <div class="grid grow items-center">
        <UCard class="mx-auto w-full max-w-sm">
            <div class="flex flex-col gap-5">
                <div class="space-y-1 text-center">
                    <h1 class="text-2xl font-extralight">Admin Console</h1>
                    <p class="text-muted text-sm">Single-owner authentication via Pocket ID</p>
                </div>

                <UAlert v-if="errorMessage" :title="errorMessage" color="error" variant="subtle" />

                <UButton
                    block
                    size="lg"
                    icon="mingcute:shield-shape-fill"
                    label="Sign in with Pocket ID"
                    :loading="signingIn"
                    @click="signInWithPocketId"
                />
            </div>
        </UCard>
    </div>
</template>
