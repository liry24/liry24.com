<script setup lang="ts">
import {
    composerModels,
    type ComposerModel,
    type ComposerRequest,
} from '~~/shared/utils/adminComposer'
const { prompt, open, scope, busy: writing } = useAdminComposer()
const { locale } = useI18n()
const route = useRoute()
const composing = ref(false)
const selection = ref<{ model?: ComposerModel; entryId?: string }>({})
const timeZone = ref('UTC')
onMounted(() => {
    timeZone.value = Intl.DateTimeFormat().resolvedOptions().timeZone
})
const input = (): ComposerRequest | null => {
    if (!import.meta.client || !prompt.value.trim()) return null
    const model = composerModels.find((name) => route.path.split('/')[2] === name)
    const entryId =
        'id' in route.params && typeof route.params.id === 'string' ? route.params.id : undefined
    return {
        prompt: prompt.value,
        locale: locale.value === 'ja' ? 'ja' : 'en',
        timeZone: timeZone.value,
        context: model ? { model, entryId } : undefined,
        ...selection.value,
    }
}
const { result, running, error, run, cancel } = useAdminComposerRequest(input, composing)
const message = ref('')
watch(scope, () => {
    cancel()
    result.value = null
    selection.value = {}
    message.value = ''
})
watch(
    prompt,
    () => {
        selection.value = {}
        message.value = ''
        if (!prompt.value.trim()) result.value = null
    },
    { flush: 'sync' },
)
const plan = computed(() => result.value?.plan)
const formKey = computed(
    () => `${scope.value}:${plan.value?.model}:${plan.value?.entryId ?? 'new'}`,
)
function edit(model: ComposerModel, id: string) {
    if (model === 'posts') {
        open.value = false
        return navigateTo('/admin/posts/' + encodeURIComponent(id))
    }
    selection.value = { model, entryId: id }
}
function saved() {
    cancel()
    result.value = null
    prompt.value = ''
    nextTick(() => {
        message.value = 'Saved'
    })
}
const target = computed(() =>
    plan.value?.intent === 'settings'
        ? '/admin/settings'
        : {
              path: plan.value?.model ? '/admin/' + plan.value.model : '/admin',
              query: plan.value?.query ? { q: plan.value.query } : undefined,
          },
)
</script>

<template>
    <div class="mx-auto w-full max-w-2xl">
        <UInput
            id="admin-compose-input"
            v-model="prompt"
            :disabled="writing"
            :loading="running"
            :aria-busy="running"
            aria-label="Content request"
            :maxlength="2000"
            class="w-full"
            size="xl"
            @compositionstart="composing = true"
            @compositionend="composing = false"
        />
        <span class="sr-only" role="status" aria-live="polite">{{
            running ? 'Preparing…' : ''
        }}</span>
        <div v-if="result || error || message" class="mt-5">
            <UAlert v-if="error" :title="error" color="warning" class="mb-4">
                <template #actions
                    ><UButton label="Retry" variant="outline" :disabled="running" @click="run"
                /></template>
            </UAlert>
            <UAlert v-if="message" :title="message" color="success" />
            <template v-if="plan && result">
                <UAlert
                    v-if="plan.dateIncomplete"
                    title="Choose a date and time"
                    description="The requested date or time needs clarification."
                    color="warning"
                    class="mb-4"
                />
                <p v-if="plan.intent === 'clarify'" class="text-muted text-sm">
                    何を作成・変更・検索したいか、もう少し詳しく教えてください。
                </p>
                <template v-else-if="plan.intent === 'create' || plan.intent === 'edit'">
                    <AdminComposerPost
                        v-if="plan.model === 'posts'"
                        :key="formKey"
                        :plan
                        :spec="result.spec"
                        :pending="running"
                    />
                    <Suspense v-else :key="formKey">
                        <AdminComposerEntry
                            :plan
                            :spec="result.spec"
                            :pending="running"
                            @saved="saved"
                        />
                        <template #fallback><USkeleton class="h-40 w-full" /></template>
                    </Suspense>
                </template>
                <AdminComposerSurface v-else :spec="result.spec">
                    <template #results>
                        <div class="grid gap-2">
                            <p v-if="!plan.results.length" class="text-muted text-sm">
                                No matching entries.
                            </p>
                            <UButton
                                v-for="entry in plan.results"
                                :key="entry.id"
                                :label="entry.title"
                                color="neutral"
                                variant="soft"
                                trailing-icon="mingcute:arrow-right-line"
                                :disabled="running"
                                @click="edit(entry.model, entry.id)"
                            />
                            <p v-if="plan.total > plan.results.length" class="text-muted text-xs">
                                {{ plan.total }} matches. Open the full screen to see all.
                            </p>
                        </div>
                    </template>
                    <template #action>
                        <UButton
                            :to="target"
                            :label="
                                plan.intent === 'settings' ? 'Open Settings' : 'Open full screen'
                            "
                            color="neutral"
                            block
                            :disabled="running"
                            @click="open = false"
                        />
                    </template>
                </AdminComposerSurface>
            </template>
        </div>
    </div>
</template>
