<script setup lang="ts">
const {
    prompt,
    scope,
    busy: writing,
    composing,
    pending: running,
    requestId,
    result,
    saved,
    error,
    retry,
    selectItem,
} = useAdminComposer()

const forms = shallowReactive<Record<string, (() => Promise<void>) | undefined>>({})
const eligible = computed(
    () =>
        result.value?.items.filter(
            (item) =>
                !saved.value[item.id] &&
                item.plan?.intent === 'create' &&
                item.plan.model !== 'posts' &&
                item.plan.model &&
                !item.plan.entryId,
        ) ?? [],
)
const saveable = computed(
    () => eligible.value.length > 0 && eligible.value.every((item) => forms[item.id]),
)

const saveAll = async () => {
    if (!saveable.value || writing.value || running.value) return

    for (const item of eligible.value) await forms[item.id]?.()
}

watch(
    requestId,
    () => {
        for (const key of Object.keys(forms)) delete forms[key]
    },
    { flush: 'sync' },
)
</script>

<template>
    <div>
        <UInput
            id="admin-compose-input"
            v-model="prompt"
            :disabled="writing"
            :loading="running"
            :aria-busy="running"
            aria-label="Content request"
            :maxlength="2000"
            variant="subtle"
            size="xl"
            :ui="{ base: 'rounded-full transition-all' }"
            class="w-full"
            @compositionstart="composing = true"
            @compositionend="composing = false"
        >
            <template #leading>
                <UButton
                    aria-label="Add content"
                    icon="mingcute:add-line"
                    variant="ghost"
                    color="neutral"
                    size="lg"
                    :ui="{ leadingIcon: 'size-5' }"
                    class="rounded-full"
                />
            </template>
        </UInput>

        <span class="sr-only" role="status" aria-live="polite">
            {{ running ? 'Preparing…' : '' }}
        </span>

        <div v-if="result || error" class="mt-5 grid gap-5">
            <UAlert v-if="error" :title="error" color="warning">
                <template #actions>
                    <UButton
                        label="Retry"
                        variant="outline"
                        :disabled="running || writing"
                        @click="retry"
                    />
                </template>
            </UAlert>

            <UAlert v-if="result?.notice" :title="result.notice" color="neutral" />

            <template v-if="result">
                <UButton
                    v-if="result.items.length > 1 && eligible.length"
                    label="Save all"
                    color="neutral"
                    :disabled="!saveable || running || writing"
                    @click="saveAll"
                />

                <p
                    v-if="
                        result.items.length > 1 &&
                        result.items.some((item) => item.plan?.model === 'posts')
                    "
                    class="text-muted text-xs"
                >
                    記事は個別にPost Editorで確認・保存してください。
                </p>

                <div
                    v-for="item in result.items"
                    :key="scope + ':' + item.id"
                    class="grid min-w-0 gap-2"
                    :class="result.items.length > 1 ? 'border-default rounded-lg border p-4' : ''"
                >
                    <p v-if="result.items.length > 1" class="text-muted text-sm wrap-break-word">
                        {{ prompt.trim().slice(item.source.start, item.source.end) }}
                    </p>

                    <AdminComposerItem
                        :item
                        :pending="running || writing"
                        @select="(model, entryId) => selectItem(item, model, entryId)"
                        @ready="(submit) => (forms[item.id] = submit)"
                    />
                </div>
            </template>
        </div>
    </div>
</template>
