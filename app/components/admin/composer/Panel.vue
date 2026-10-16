<script setup lang="ts">
import type { ComposerModel, ComposerRequest } from '~~/shared/utils/adminComposer'
const { prompt, open, scope, busy: writing } = useAdminComposer()
const { locale } = useI18n()
const client = useAdminClient()
const modelsKey = computed(() => 'composer-models:' + scope.value)
const { data: models } = await useAsyncData(modelsKey, () => client.models())
const composing = ref(false)
const selection = ref<{ model?: ComposerModel; entryId?: string }>({})
const timeZone = ref('UTC')
onMounted(() => {
    timeZone.value = Intl.DateTimeFormat().resolvedOptions().timeZone
})
const input = (): ComposerRequest | null =>
    !import.meta.client || !prompt.value.trim()
        ? null
        : {
              prompt: prompt.value,
              locale: locale.value === 'ja' ? 'ja' : 'en',
              timeZone: timeZone.value,
              ...selection.value,
          }
const { result, running, error, fallback, run, cancel } = useAdminComposerRequest(input, composing)
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
function choose(model: string) {
    if (error.value) {
        open.value = false
        return navigateTo('/admin/' + model)
    }
    if (!prompt.value.trim()) prompt.value = 'Create a new ' + model
    selection.value = { model: model as ComposerModel }
}
function edit(id: string) {
    if (plan.value?.model === 'posts') {
        open.value = false
        return navigateTo('/admin/posts/' + encodeURIComponent(id))
    }
    selection.value = { model: plan.value?.model ?? undefined, entryId: id }
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
              path: '/admin/' + plan.value?.model,
              query: plan.value?.query ? { q: plan.value.query } : undefined,
          },
)
</script>

<template>
    <div class="mx-auto w-full max-w-2xl">
        <div
            class="border-default bg-default overflow-hidden rounded-2xl border shadow-sm transition-shadow focus-within:shadow-md"
        >
            <div class="relative p-5 sm:p-6">
                <label
                    for="admin-compose-input"
                    class="text-highlighted mb-3 block text-lg font-medium"
                    >What would you like to do?</label
                >
                <UTextarea
                    id="admin-compose-input"
                    v-model="prompt"
                    :disabled="writing"
                    placeholder="明日の18時に投稿を予約したい…"
                    :maxlength="2000"
                    :rows="2"
                    :maxrows="5"
                    autoresize
                    variant="none"
                    class="w-full"
                    size="xl"
                    aria-describedby="admin-compose-hint"
                    @compositionstart="composing = true"
                    @compositionend="composing = false"
                />
                <div
                    id="admin-compose-hint"
                    class="text-muted mt-3 flex items-center justify-between gap-3 text-xs"
                >
                    <span>Create, find, or edit your content.</span>
                    <span role="status" aria-live="polite">{{
                        running ? 'Preparing…' : 'Changes are saved only when you confirm.'
                    }}</span>
                </div>
            </div>
            <UProgress
                v-if="running"
                :model-value="undefined"
                size="2xs"
                aria-label="Preparing your form"
            />
            <div v-if="result || error || message" class="border-default border-t p-5 sm:p-6">
                <UAlert v-if="error" :title="error" color="warning" class="mb-4">
                    <template #actions
                        ><UButton label="Retry" variant="outline" :disabled="running" @click="run"
                    /></template>
                </UAlert>
                <UAlert v-if="message" :title="message" color="success" />
                <template v-if="plan && result">
                    <div class="text-muted mb-4 flex items-center justify-between text-xs">
                        <span>{{
                            models?.find((model) => model.name === plan?.model)?.meta.plural
                        }}</span>
                        <span v-if="fallback">All fields available</span>
                    </div>
                    <UAlert
                        v-if="plan.dateIncomplete"
                        title="Choose a date and time"
                        description="The requested date or time needs clarification. Review it before continuing."
                        color="warning"
                        class="mb-4"
                    />
                    <p v-if="plan.intent === 'clarify'" class="text-muted text-sm">
                        Add a little more detail, or choose a content type below.
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
                                    @click="edit(entry.id)"
                                />
                                <p
                                    v-if="plan.total > plan.results.length"
                                    class="text-muted text-xs"
                                >
                                    {{ plan.total }} matches. Open the full screen to see all.
                                </p>
                            </div>
                        </template>
                        <template #action>
                            <UButton
                                :to="target"
                                :label="
                                    plan.intent === 'settings'
                                        ? 'Open Settings'
                                        : 'Open full screen'
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
        <p v-if="error" class="text-muted mt-4 text-center text-xs">
            Continue on a regular content screen:
        </p>
        <div class="mt-4 flex flex-wrap justify-center gap-1.5">
            <UButton
                v-for="model in models"
                :key="model.name"
                :label="model.meta.label"
                :icon="model.meta.icon"
                color="neutral"
                variant="ghost"
                size="xs"
                :disabled="writing"
                @click="choose(model.name)"
            />
        </div>
    </div>
</template>
