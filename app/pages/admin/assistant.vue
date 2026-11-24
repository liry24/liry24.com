<script setup lang="ts">
import type { PromptInputSubmit } from '@vite-hub/ui'
import { useAgent, useChat } from 'vite-hub/agent/vue'

useHead({ title: 'Assistant' })

const input = ref('')
const agent = useAgent('assistant')
const { messages, status, error, sendMessage, stop, clearError } = useChat(agent)

const busy = computed(() => status.value === 'submitted' || status.value === 'streaming')

const handleSubmit = async (payload: PromptInputSubmit) => {
    const text = payload.text.trim()
    if (!text && payload.files.length === 0) {
        return
    }
    clearError()
    input.value = ''
    if (text) {
        if (payload.files.length > 0) {
            await sendMessage({
                text,
                files: [...payload.files],
            })
        } else {
            await sendMessage({ text })
        }
        return
    }
    await sendMessage({
        files: [...payload.files],
    })
}

const resetConversation = async () => {
    await stop()
    clearError()
    messages.value = []
    input.value = ''
}
</script>

<template>
    <UDashboardPanel
        id="assistant"
        :ui="{
            root: 'h-full min-h-0',
            body: 'flex flex-col gap-4 p-4 sm:p-6 min-h-0 flex-1 overflow-hidden',
        }"
    >
        <template #header>
            <UDashboardNavbar title="Editorial Assistant" icon="mingcute:sparkles-2-fill">
                <template #right>
                    <UBadge label="gemini-4-hydrogen" variant="subtle" color="neutral" />
                    <UButton
                        label="Clear chat"
                        icon="mingcute:delete-2-line"
                        variant="outline"
                        color="neutral"
                        size="sm"
                        :disabled="busy || messages.length === 0"
                        @click="resetConversation"
                    />
                </template>
            </UDashboardNavbar>
        </template>

        <template #body>
            <UAlert
                v-if="error"
                :title="error.message || 'Assistant request failed.'"
                color="error"
                variant="subtle"
                close
                @update:open="clearError"
            />

            <div class="border-default min-h-0 flex-1 overflow-y-auto rounded-lg border p-4">
                <p v-if="messages.length === 0" class="text-muted text-sm">
                    Ask Gemini 4 Hydrogen to inspect collections, draft posts, or prepare updates.
                </p>
                <Chat v-else :messages="messages" :status="status" />
            </div>

            <PromptInput
                v-model="input"
                :status="status"
                placeholder="Ask the editorial assistant…"
                @submit="handleSubmit"
                @stop="stop"
            />
        </template>
    </UDashboardPanel>
</template>
