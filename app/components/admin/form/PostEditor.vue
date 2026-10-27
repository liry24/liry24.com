<script setup lang="ts">
import { useArticleReview } from '@litijs/blog/vue'
const { id, composerId } = defineProps<{ id?: string; composerId?: string }>()
const publishAt = ref('')
const running = ref('')
const failure = ref('')
const { post: composerProposal, scope: composerScope, saved } = useAdminComposer()
const {
    form,
    id: entryId,
    values,
    receipt,
    isDirty,
    hasUnsavedChanges,
    save,
    publish,
    schedule,
    error,
    warnings,
} = await useLitiForm('posts', {
    id: () => id,
    defaultValues: { title: '', tags: [] },
    body: '',
    onSuccess: async (result, { hasUnsavedChanges }) => {
        if (composerId) saved.value[composerId] = true
        if (!id && !composerId && !hasUnsavedChanges)
            await navigateTo(`/admin/posts/${encodeURIComponent(result.id)}`, { replace: true })
    },
})
const request = useRequestFetch()
const origin = useRequestURL().origin
const review = useArticleReview({
    source: () => ({
        identity: `posts:${entryId.value}:ja`,
        body: values.value.body ?? '',
        revision: receipt.value?.revision,
    }),
    protect: (body) => Array.from(body.matchAll(/<game:[^>\r\n]+>/gu), (match) => match[0]),
    execute: (input, signal) =>
        request('/api/admin/posts/proofread', {
            method: 'POST',
            body: input,
            signal,
            headers: { origin },
        }),
    apply: (body) => form.setFieldValue('body', body),
})
const pendingComposer = computed(() =>
    !id &&
    composerProposal.value?.scope === composerScope.value &&
    composerProposal.value.itemId === composerId
        ? composerProposal.value
        : null,
)
function applyComposer() {
    const proposal = pendingComposer.value
    if (!proposal) return
    if (typeof proposal.values.title === 'string')
        form.setFieldValue('data.title', proposal.values.title)
    if (Array.isArray(proposal.values.tags)) form.setFieldValue('data.tags', proposal.values.tags)
    publishAt.value = proposal.publishAt
    composerProposal.value = null
}
const busy = computed(() => Boolean(running.value))
const canPublish = computed(
    () =>
        Boolean(receipt.value?.digest) &&
        !isDirty.value &&
        !busy.value &&
        !['pending', 'proposed'].includes(review.state.value.status),
)
async function run(action: string, task: () => Promise<unknown>) {
    if (busy.value) return
    running.value = action
    failure.value = ''
    try {
        await task()
    } catch (cause) {
        failure.value = adminErrorMessage(cause, 'The operation failed.')
    } finally {
        running.value = ''
    }
}
async function upload(files: File | File[] | null | undefined) {
    const selected = Array.isArray(files) ? files : files ? [files] : []
    if (!selected.length) return
    const before = JSON.stringify(values.value.data.cover)
    await run('upload', async () => {
        const body = new FormData()
        body.append('files', selected[0]!)
        const references = await request<import('@vite-hub/blob/reference').BlobReference[]>(
            '/api/admin/images',
            { method: 'POST', query: { model: 'posts' }, body, headers: { origin } },
        )
        if (before !== JSON.stringify(values.value.data.cover))
            throw new Error('The cover changed during upload. Your newer selection was kept.')
        form.setFieldValue('data.cover', references[0])
    })
}
watch(
    pendingComposer,
    (proposal) => {
        if (proposal && !isDirty.value) applyComposer()
    },
    { immediate: true },
)
onBeforeRouteLeave(
    () => !id || !hasUnsavedChanges.value || window.confirm('Discard unsaved changes?'),
)
</script>

<template>
    <AdminResourcePage :title="id ? 'Edit Post' : 'New Post'" icon="mingcute:book-3-fill">
        <template #actions>
            <UButton
                to="/admin/data?model=posts"
                label="Back to Posts"
                variant="ghost"
                color="neutral"
            />
            <form.Subscribe :selector="(state) => state.isSubmitting" v-slot="saving">
                <UButton
                    label="Save Draft"
                    icon="mingcute:save-line"
                    color="neutral"
                    :loading="saving"
                    :disabled="busy"
                    @click="run('save', save)"
                />
            </form.Subscribe>
            <UButton
                label="Publish"
                icon="mingcute:upload-3-fill"
                color="neutral"
                :loading="running === 'publish'"
                :disabled="!canPublish"
                @click="run('publish', publish)"
            />
        </template>
        <UAlert v-if="pendingComposer" title="A prepared post is available" color="neutral">
            <template #actions
                ><UButton label="Apply prepared values" @click="applyComposer" /><UButton
                    label="Keep existing input"
                    variant="outline"
                    @click="composerProposal = null"
            /></template>
        </UAlert>
        <UAlert v-if="failure || error" :title="failure || String(error)" color="error" />
        <UAlert
            v-for="warning in warnings"
            :key="warning.code"
            :title="warning.message"
            color="warning"
        />
        <form class="grid gap-6" @submit.prevent="run('save', save)">
            <fieldset :disabled="running === 'upload'" class="grid min-w-0 gap-6">
                <UFormField label="Title" required
                    ><AdminFormGameInput
                        :id="entryId + '-title'"
                        :model-value="values.data.title ?? ''"
                        placeholder="Post title"
                        @update:model-value="form.setFieldValue('data.title', $event)"
                /></UFormField>
                <div class="grid min-w-0 gap-4 xl:grid-cols-2">
                    <UFormField
                        label="Content"
                        required
                        description="Markdown and game tags are supported."
                        ><AdminFormGameInput
                            :id="entryId + '-body'"
                            :model-value="values.body ?? ''"
                            multiline
                            placeholder="Write your post…"
                            @update:model-value="form.setFieldValue('body', $event)"
                    /></UFormField>
                    <section
                        aria-label="Markdown preview"
                        class="border-default min-w-0 rounded-lg border p-4"
                    >
                        <h2 class="text-muted mb-4 text-sm">Preview</h2>
                        <h3 class="mb-4 text-2xl font-bold">
                            <PostTitle :title="values.data.title ?? ''" />
                        </h3>
                        <Suspense
                            ><Markdown
                                :value="values.body ?? ''"
                                :plugins="[postMarkdownSecurity]"
                                class="wrap-break-word *:first:mt-0 *:last:mb-0"
                        /></Suspense>
                    </section>
                </div>
                <div class="flex gap-2">
                    <UButton
                        label="Proofread Content"
                        icon="mingcute:edit-3-ai-line"
                        variant="outline"
                        color="neutral"
                        :loading="review.state.value.status === 'pending'"
                        :disabled="!values.body || busy"
                        @click="review.propose()"
                    /><UButton
                        v-if="review.state.value.status === 'pending'"
                        label="Cancel"
                        variant="ghost"
                        @click="review.cancel"
                    />
                </div>
                <UAlert
                    v-if="review.state.value.error"
                    :title="String(review.state.value.error)"
                    color="error"
                />
                <section
                    v-if="review.state.value.status === 'proposed'"
                    aria-label="Proofreading suggestion"
                    class="border-default grid gap-4 rounded-lg border p-4"
                >
                    <h2 class="font-medium">Proofreading suggestion</h2>
                    <UAlert
                        v-if="review.stale.value"
                        title="Content has changed. Run proofreading again."
                        color="warning"
                    />
                    <div class="grid gap-4 lg:grid-cols-2">
                        <div>
                            <h3>Original</h3>
                            <pre class="max-h-80 overflow-auto whitespace-pre-wrap">{{
                                review.state.value.source?.body
                            }}</pre>
                        </div>
                        <div>
                            <h3>Suggested</h3>
                            <pre class="max-h-80 overflow-auto whitespace-pre-wrap">{{
                                review.state.value.proposal?.body
                            }}</pre>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <UButton
                            label="Apply Suggestion"
                            :disabled="!review.canApply.value"
                            @click="review.apply"
                        /><UButton
                            label="Discard Suggestion"
                            variant="ghost"
                            @click="review.discard"
                        />
                    </div>
                </section>
                <UFormField
                    label="Slug"
                    description="A blank new slug is generated deterministically. An established slug stays unchanged."
                    ><UInput
                        :id="entryId + '-slug'"
                        :model-value="values.data.slug ?? ''"
                        class="w-full"
                        @update:model-value="form.setFieldValue('data.slug', $event)"
                /></UFormField>
                <UFormField label="Summary"
                    ><UTextarea
                        :id="entryId + '-summary'"
                        :model-value="values.data.summary ?? ''"
                        class="w-full"
                        @update:model-value="form.setFieldValue('data.summary', $event)"
                /></UFormField>
                <UFormField label="Tags"
                    ><UInputTags
                        :id="entryId + '-tags'"
                        :model-value="values.data.tags ?? []"
                        data-post-tags
                        add-on-paste
                        class="w-full"
                        @update:model-value="
                            form.setFieldValue(
                                'data.tags',
                                $event.filter((tag): tag is string => typeof tag === 'string'),
                            )
                        "
                /></UFormField>
                <UFormField label="Article date"
                    ><UInput
                        type="date"
                        :id="entryId + '-authoredAt'"
                        :model-value="values.data.authoredAt?.slice(0, 10) ?? ''"
                        @update:model-value="
                            form.setFieldValue('data.authoredAt', $event || undefined)
                        "
                /></UFormField>
                <div class="flex flex-wrap items-end gap-3">
                    <UFormField label="Publish at" description="Your browser's time zone."
                        ><UInput
                            :id="entryId + '-publish-at'"
                            v-model="publishAt"
                            type="datetime-local" /></UFormField
                    ><UButton
                        label="Schedule Publish"
                        variant="outline"
                        color="neutral"
                        :loading="running === 'schedule'"
                        :disabled="!canPublish || !publishAt"
                        @click="run('schedule', () => schedule(new Date(publishAt)))"
                    />
                </div>
                <UFormField label="Cover">
                    <!-- @vue-generic {false, File} -->
                    <UFileUpload
                        :model-value="null"
                        reset
                        accept="image/*"
                        label="Upload Image"
                        :disabled="busy"
                        @update:model-value="upload"
                    />
                    <div v-if="values.data.cover" class="mt-3 flex gap-2">
                        <img
                            :src="mediaUrl(values.data.cover)"
                            alt="Post cover"
                            class="size-16 rounded-lg object-cover"
                        /><UButton
                            label="Remove cover"
                            variant="ghost"
                            @click="form.setFieldValue('data.cover', undefined)"
                        />
                    </div>
                </UFormField>
            </fieldset>
        </form>
    </AdminResourcePage>
</template>
