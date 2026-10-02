<script setup lang="ts">
definePageMeta({
    layout: 'minimal',
})

const toast = useToast()
const passkey = useSignIn('passkey')
const social = useSignIn('social')
const isPreview = String(useRuntimeConfig().public.preview) === 'true'

const signInWithPasskey = async () => {
    await passkey.execute()
    if (passkey.error.value) {
        toast.add({
            title: 'Passkeyでログインできませんでした',
            description: passkey.error.value.message,
            color: 'error',
        })
        return
    }
}

const signInWithGitHub = () => social.execute({ provider: 'github' })
const signInWithVercel = () => social.execute({ provider: 'vercel' })
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
