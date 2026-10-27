<script setup lang="ts">
definePageMeta({
    layout: 'minimal',
})

const toast = useToast()
const signingIn = ref(false)
const isPreview = String(useRuntimeConfig().public.preview) === 'true'

const signInWithPasskey = async () => {
    if (signingIn.value) return
    signingIn.value = true
    try {
        const result = await authClient.signIn.passkey()
        if (result.error) throw result.error
        await navigateTo('/admin')
    } catch (error) {
        toast.add({
            title: 'Passkeyでログインできませんでした',
            description: error instanceof Error ? error.message : 'Please try again.',
            color: 'error',
        })
    } finally {
        signingIn.value = false
    }
}

const signInWithGitHub = () =>
    authClient.signIn.social({ provider: 'github', callbackURL: '/admin' })
const signInWithVercel = () =>
    authClient.signIn.social({ provider: 'vercel', callbackURL: '/admin' })
</script>

<template>
    <div class="grid grow items-center">
        <UAuthForm
            title="Admin Console"
            :providers="[
                ...(!isPreview
                    ? [
                          {
                              icon: 'mingcute:key-2-fill',
                              label: 'Passkey',
                              onClick: signInWithPasskey,
                          },
                      ]
                    : []),
                {
                    icon: 'mingcute:github-fill',
                    label: 'GitHub',
                    onClick: signInWithGitHub,
                },
                ...(!isPreview
                    ? [
                          {
                              icon: 'mingcute:triangle-fill',
                              label: 'Vercel',
                              onClick: signInWithVercel,
                          },
                      ]
                    : []),
            ]"
            :ui="{ title: 'font-extralight text-4xl' }"
            class="mx-auto max-w-sm"
        />
    </div>
</template>
