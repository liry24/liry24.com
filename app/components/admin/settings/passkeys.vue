<script setup lang="ts">
import type { Passkey } from '@better-auth/passkey'

const client = useAuthClient()
const { fetchSession } = useUserSession()
const toast = useToast()

const passkeys = ref<Passkey[]>([])
const passkeyNames = ref<Record<string, string>>({})
const newPasskeyName = ref('')
const busyPasskeyId = ref<string | null>(null)
const addingPasskey = ref(false)
const passkeyPendingDeletion = ref<Passkey | null>(null)

const deleteModalOpen = computed({
    get: () => passkeyPendingDeletion.value !== null,
    set: (open) => {
        if (!open) passkeyPendingDeletion.value = null
    },
})

const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : 'Please try again later.'

const loadPasskeys = async () => {
    if (!client) throw new Error('Authentication client is unavailable')
    const { data, error } = await client.passkey.listUserPasskeys()
    if (error) throw error

    passkeys.value = data || []
    passkeyNames.value = Object.fromEntries(
        passkeys.value.map((passkey) => [passkey.id, passkey.name || '']),
    )
}

const addPasskey = async () => {
    if (!window.PublicKeyCredential) {
        toast.add({
            icon: 'mingcute:close-line',
            title: 'Passkeys are not supported',
            description: 'Use a browser or device that supports passkeys.',
            color: 'error',
        })
        return
    }

    addingPasskey.value = true
    try {
        if (!client) throw new Error('Authentication client is unavailable')
        await fetchSession({ force: true })
        const { error } = await client.passkey.addPasskey({
            name: newPasskeyName.value.trim() || undefined,
        })
        if (error) throw error

        newPasskeyName.value = ''
        await loadPasskeys()
        toast.add({
            icon: 'mingcute:check-line',
            title: 'Passkey added',
            color: 'success',
        })
    } catch (error) {
        console.error(error)
        toast.add({
            icon: 'mingcute:close-line',
            title: 'Failed to add passkey',
            description: errorMessage(error),
            color: 'error',
        })
    } finally {
        addingPasskey.value = false
    }
}

const renamePasskey = async (passkey: Passkey) => {
    const name = passkeyNames.value[passkey.id]?.trim()
    if (!name) {
        toast.add({
            icon: 'mingcute:close-line',
            title: 'A passkey name is required',
            color: 'error',
        })
        return
    }

    busyPasskeyId.value = passkey.id
    try {
        if (!client) throw new Error('Authentication client is unavailable')
        const { error } = await client.passkey.updatePasskey({ id: passkey.id, name })
        if (error) throw error

        await loadPasskeys()
        toast.add({
            icon: 'mingcute:check-line',
            title: 'Passkey renamed',
            color: 'success',
        })
    } catch (error) {
        console.error(error)
        toast.add({
            icon: 'mingcute:close-line',
            title: 'Failed to rename passkey',
            description: errorMessage(error),
            color: 'error',
        })
    } finally {
        busyPasskeyId.value = null
    }
}

const deletePasskey = async () => {
    const passkey = passkeyPendingDeletion.value
    if (!passkey) return

    busyPasskeyId.value = passkey.id
    try {
        if (!client) throw new Error('Authentication client is unavailable')
        const { error } = await client.passkey.deletePasskey({ id: passkey.id })
        if (error) throw error

        passkeyPendingDeletion.value = null
        await loadPasskeys()
        toast.add({
            icon: 'mingcute:check-line',
            title: 'Passkey deleted',
            color: 'success',
        })
    } catch (error) {
        console.error(error)
        toast.add({
            icon: 'mingcute:close-line',
            title: 'Failed to delete passkey',
            description: errorMessage(error),
            color: 'error',
        })
    } finally {
        busyPasskeyId.value = null
    }
}

const passkeyLabel = (passkey: Passkey) => passkey.name || 'Passkey'

const deviceLabel = (passkey: Passkey) =>
    passkey.deviceType === 'multiDevice' ? 'Synced across devices' : 'This device only'

onMounted(() => {
    void loadPasskeys().catch((error: unknown) => {
        console.error(error)
        toast.add({
            icon: 'mingcute:close-line',
            title: 'Failed to load passkeys',
            description: errorMessage(error),
            color: 'error',
        })
    })
})
</script>

<template>
    <UCard :ui="{ header: 'flex' }">
        <template #header>
            <h2 class="my-2 text-xl leading-none font-semibold text-nowrap">Passkeys</h2>
            <UModal>
                <UButton
                    label="Create passkey"
                    icon="mingcute:add-line"
                    color="neutral"
                    class="ml-auto"
                />
                <template #body>
                    <UInput
                        v-model="newPasskeyName"
                        placeholder="Name this passkey (optional)"
                        autocomplete="off"
                    />
                    <UButton
                        label="Create"
                        color="neutral"
                        size="lg"
                        block
                        :loading="addingPasskey"
                        @click="addPasskey"
                    />
                </template>
            </UModal>
        </template>

        <div class="flex flex-col gap-6">
            <div
                v-if="passkeys.length"
                class="divide-default border-default flex flex-col divide-y rounded-lg border"
            >
                <div
                    v-for="passkey in passkeys"
                    :key="passkey.id"
                    class="flex flex-col gap-4 p-4 lg:flex-row lg:items-center"
                >
                    <div class="min-w-0 grow">
                        <p class="truncate font-medium">{{ passkeyLabel(passkey) }}</p>
                        <div class="text-muted mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                            <span>{{ deviceLabel(passkey) }}</span>
                            <span>
                                Added
                                <NuxtTime :datetime="passkey.createdAt" date-style="medium" />
                            </span>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2 sm:flex-row">
                        <UInput
                            v-model="passkeyNames[passkey.id]"
                            :aria-label="`Name for ${passkeyLabel(passkey)}`"
                            class="sm:w-56"
                        />
                        <UButton
                            label="Rename"
                            variant="subtle"
                            color="neutral"
                            :loading="busyPasskeyId === passkey.id"
                            @click="renamePasskey(passkey)"
                        />
                        <UButton
                            label="Delete"
                            variant="subtle"
                            color="error"
                            :disabled="busyPasskeyId !== null"
                            @click="passkeyPendingDeletion = passkey"
                        />
                    </div>
                </div>
            </div>

            <p v-else class="text-muted text-sm">No passkeys have been added yet.</p>
        </div>
    </UCard>

    <UModal v-model:open="deleteModalOpen" title="Delete passkey">
        <template #body>
            <UAlert
                icon="mingcute:alert-fill"
                title="Delete this passkey?"
                :description="`You will no longer be able to sign in with ${passkeyPendingDeletion ? passkeyLabel(passkeyPendingDeletion) : 'this passkey'}.`"
                color="error"
                variant="subtle"
            />
        </template>

        <template #footer>
            <div class="flex w-full justify-end gap-2">
                <UButton label="Cancel" variant="ghost" @click="deleteModalOpen = false" />
                <UButton
                    label="Delete passkey"
                    color="error"
                    :loading="busyPasskeyId === passkeyPendingDeletion?.id"
                    @click="deletePasskey"
                />
            </div>
        </template>
    </UModal>
</template>
