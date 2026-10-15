<script setup lang="ts">
import { useSelector } from '@tanstack/vue-form'

const props = defineProps<{ id?: string }>()
const saved = ref(false)
const savePending = ref(false)
const intent = ref<'proofread' | 'publish' | 'schedule' | null>(null)
const localError = ref('')
const publishAt = ref('')
const uploading = ref(false)
const uploadedName = ref('')
const resource = await useAdminEntry('posts', () => props.id ?? null)
if (resource.error.value) throw resource.error.value
const {
    form,
    draft,
    publish: publishEntry,
    schedule: scheduleEntry,
    upload: uploadAsset,
} = useEntryForm(resource, {
    ...(!props.id ? { defaultValues: { publication: { slug: 'auto' } } } : {}),
    onSuccess: async () => {
        if (intent.value) return
        saved.value = true
        await navigateTo('/admin/posts')
    },
})
const { error, status } = resource
const values = useSelector(form.atom, (state) => state.values)
const saving = useSelector(form.atom, (state) => state.isSubmitting)
const dirty = draft.isDirty
const conflict = computed(() => error.value?.data?.code === 'SITE_ADMIN_CONFLICT')
const restored = ref(dirty.value)
const slug = computed({
    get: () => String(values.value.slug ?? ''),
    set: (value) => form.setFieldValue('slug', value),
})
const manualSlug = computed({
    get: () => postPublicationSettings(values.value).slug === 'manual',
    set: (manual) => {
        const settings = postPublicationSettings(values.value)
        form.setFieldValue('publication', { ...settings, slug: manual ? 'manual' : 'auto' })
        if (!manual && settings.publishedSlug) slug.value = settings.publishedSlug
    },
})
const content = computed(() => values.value.content)
const management = useAdminClient()
const proposal = shallowRef<PostEditorialProposal | null>(null)
const originalContent = computed(() => String(proposal.value?.snapshot.draft.content ?? ''))
const aiError = shallowRef<Error | null>(null)
const proofreadInput = shallowRef({ content: '' })
const proofreadAction = await useAi('proofread', {
    input: () => proofreadInput.value,
    immediate: false,
})
const currentDraft = () => draft.snapshot()
const proposalStale = computed(() =>
    proposal.value ? draft.isStale(proposal.value.snapshot) : false,
)
function discardSuggestion() {
    proposal.value = null
    aiError.value = null
    proofreadAction.clear()
}
const proofreading = computed(() => intent.value === 'proofread')
const busy = computed(
    () =>
        savePending.value ||
        saving.value ||
        uploading.value ||
        status.value === 'pending' ||
        intent.value !== null ||
        proofreadAction.status.value === 'pending',
)
const awaitingProofreading = computed(() => proposal.value?.kind === 'proofread')
const errorMessage = computed(() => {
    if (localError.value) return localError.value
    const cause = error.value || aiError.value
    return cause instanceof Error ? cause.message : error.value?.message
})
const invalidProposal = computed(() =>
    Boolean(
        proposal.value &&
        (typeof proposal.value.data.content !== 'string' || !proposal.value.data.content.trim()),
    ),
)
onBeforeRouteLeave(() => {
    if (busy.value && !saved.value) return false
})
useEventListener('beforeunload', (event) => {
    if (!dirty.value && !busy.value) return
    event.preventDefault()
    event.returnValue = ''
})
async function save() {
    if (busy.value || conflict.value) return
    savePending.value = true
    localError.value = ''
    try {
        await form.handleSubmit()
    } finally {
        savePending.value = false
    }
}
function submit() {
    if (document.activeElement?.matches('[data-post-tags]')) return
    void save()
}
async function ensureDraft() {
    if (!values.value.title.trim() || !content.value.trim()) {
        localError.value = 'Write a title and content before using AI or publishing.'
        return false
    }
    if (draft.snapshot().entryId) return true
    await form.handleSubmit()
    return !error.value && Boolean(draft.snapshot().entryId)
}
function actionFailure(error: unknown, fallback: string) {
    if (error && typeof error === 'object') {
        const data = Reflect.get(error, 'data')
        const failure = data && typeof data === 'object' ? Reflect.get(data, 'error') : undefined
        const message =
            failure && typeof failure === 'object' ? Reflect.get(failure, 'message') : undefined
        if (typeof message === 'string' && message) return new Error(message, { cause: error })
    }
    return error instanceof Error ? error : new Error(fallback)
}
async function proofread() {
    if (busy.value || conflict.value || !content.value.trim()) return
    intent.value = 'proofread'
    localError.value = ''
    discardSuggestion()
    try {
        if (!(await ensureDraft())) return
        const result = await preparePostProofreading(
            { management, current: currentDraft },
            async (props) => {
                proofreadInput.value = props
                await proofreadAction.execute()
                if (proofreadAction.error.value) throw proofreadAction.error.value
                if (!proofreadAction.data.value)
                    throw new Error('No proofreading suggestion was returned.')
                return proofreadAction.data.value
            },
        )
        proposal.value = result
    } catch (error) {
        aiError.value = actionFailure(error, 'Proofreading failed. Your content is kept.')
    } finally {
        intent.value = null
    }
}
function applyProofreading() {
    if (busy.value || invalidProposal.value || proposalStale.value || !proposal.value) return
    form.setFieldValue('content', String(proposal.value.data.content))
    discardSuggestion()
}
async function publish(schedule = false) {
    if (busy.value || conflict.value || awaitingProofreading.value) return
    if (manualSlug.value && !slug.value.trim()) {
        localError.value = 'Enter a slug or use automatic generation.'
        return
    }
    let at: string | undefined
    if (schedule) {
        const date = new Date(publishAt.value)
        if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
            localError.value = 'Choose a future publication time.'
            return
        }
        at = date.toISOString()
    }
    intent.value = schedule ? 'schedule' : 'publish'
    localError.value = ''
    discardSuggestion()
    try {
        const result = at ? await scheduleEntry(at) : await publishEntry()
        if (!result) return
        saved.value = true
        await navigateTo('/admin/posts')
    } catch (error) {
        aiError.value = actionFailure(error, 'Publication failed. Your draft is kept.')
    } finally {
        intent.value = null
    }
}

async function upload(files: File | File[] | null | undefined) {
    if (!files || busy.value) return
    const file = Array.isArray(files) ? files[0] : files
    if (!file) return
    uploading.value = true
    try {
        await uploadAsset('image', file)
        uploadedName.value = file.name
    } catch {
        // resource.error displays the upload failure.
    } finally {
        uploading.value = false
    }
}
</script>

<template>
    <AdminResourcePage :title="id ? 'Edit Post' : 'New Post'" icon="mingcute:book-3-fill">
        <template #actions>
            <UButton
                to="/admin/posts"
                label="Back to Posts"
                variant="ghost"
                color="neutral"
                :disabled="busy"
            />
            <UButton
                type="submit"
                form="admin-post-form"
                label="Save Draft"
                icon="mingcute:save-line"
                color="neutral"
                :loading="saving"
                :disabled="busy || conflict"
            />
            <UButton
                label="Publish"
                icon="mingcute:upload-3-fill"
                color="neutral"
                :loading="intent === 'publish'"
                :disabled="busy || conflict || awaitingProofreading"
                @click="publish()"
            />
        </template>
        <UAlert
            v-if="restored"
            title="Unsaved input restored"
            description="Input is kept while you move between pages in this session. Save your draft before closing or reloading this tab."
            color="neutral"
        />
        <UAlert
            v-if="conflict"
            title="Conflict detected"
            description="Your input is kept. Open the latest entry in another tab and compare your changes before saving."
            color="warning"
        />
        <UAlert v-if="errorMessage" :title="errorMessage" color="error" />
        <form id="admin-post-form" class="grid gap-6" @submit.prevent="submit">
            <fieldset :disabled="busy" class="grid min-w-0 gap-6">
                <form.Field name="title">
                    <template #default="{ field }">
                        <UFormField
                            label="Title"
                            required
                            :error="
                                field.errors
                                    .map((error) =>
                                        typeof error === 'string' ? error : error.message,
                                    )
                                    .join(', ') || undefined
                            "
                        >
                            <UInput
                                :model-value="String(field.value ?? '')"
                                size="xl"
                                variant="soft"
                                class="w-full"
                                placeholder="Post title"
                                @update:model-value="(value) => form.setFieldValue('title', value)"
                                @blur="field.handleBlur"
                            />
                        </UFormField>
                    </template>
                </form.Field>
                <div class="grid min-w-0 gap-4 xl:grid-cols-2">
                    <form.Field name="content">
                        <template #default="{ field }">
                            <UFormField
                                label="Content"
                                required
                                description="Write in Markdown. Post cards use a short introduction from your content."
                                :error="
                                    field.errors
                                        .map((error) =>
                                            typeof error === 'string' ? error : error.message,
                                        )
                                        .join(', ') || undefined
                                "
                            >
                                <UTextarea
                                    :model-value="String(field.value ?? '')"
                                    :rows="20"
                                    autoresize
                                    variant="soft"
                                    class="w-full"
                                    :ui="{ base: 'font-mono text-sm' }"
                                    placeholder="Write your post…"
                                    @update:model-value="
                                        (value) => form.setFieldValue('content', value)
                                    "
                                    @blur="field.handleBlur"
                                />
                            </UFormField>
                        </template>
                    </form.Field>
                    <section
                        aria-label="Markdown preview"
                        class="border-default min-w-0 rounded-lg border p-4"
                    >
                        <h2 class="text-muted mb-4 text-sm font-medium">Preview</h2>
                        <Suspense>
                            <Markdown
                                :value="content"
                                :plugins="[postMarkdownSecurity]"
                                class="sentence wrap-break-word *:first:mt-0 *:last:mb-0"
                            />
                        </Suspense>
                    </section>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <UButton
                        label="Proofread Content"
                        icon="mingcute:edit-3-ai-line"
                        variant="outline"
                        color="neutral"
                        :loading="proofreading"
                        :disabled="busy || !content.trim()"
                        @click="proofread"
                    />
                    <p class="text-muted text-sm">Review the suggestion before applying it.</p>
                </div>
                <section
                    v-if="awaitingProofreading"
                    aria-label="Proofreading suggestion"
                    class="border-default grid gap-4 rounded-lg border p-4"
                >
                    <h2 class="font-medium">Proofreading suggestion</h2>
                    <UAlert
                        v-if="proposalStale"
                        title="Content has changed"
                        description="Run proofreading again before applying a suggestion to this content."
                        color="warning"
                    />
                    <UAlert
                        v-if="invalidProposal"
                        title="Invalid proofreading suggestion"
                        description="Your content is kept. Run proofreading again to get a complete suggestion."
                        color="error"
                    />
                    <div class="grid min-w-0 gap-4 lg:grid-cols-2">
                        <div>
                            <h3 class="text-muted mb-2 text-sm">Original</h3>
                            <pre
                                class="bg-muted max-h-80 overflow-auto rounded-lg p-3 text-sm wrap-break-word whitespace-pre-wrap"
                                >{{ originalContent }}</pre>
                        </div>
                        <div>
                            <h3 class="text-muted mb-2 text-sm">Suggested</h3>
                            <pre
                                class="bg-muted max-h-80 overflow-auto rounded-lg p-3 text-sm wrap-break-word whitespace-pre-wrap"
                                >{{ proposal?.data.content }}</pre>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <UButton
                            label="Apply Suggestion"
                            color="neutral"
                            :disabled="busy || proposalStale || invalidProposal"
                            @click="applyProofreading"
                        />
                        <UButton
                            label="Discard Suggestion"
                            variant="ghost"
                            color="neutral"
                            @click="discardSuggestion"
                        />
                    </div>
                </section>
                <div class="grid content-start gap-3">
                    <UCheckbox v-model="manualSlug" label="Enter slug manually" />
                    <UFormField
                        v-if="manualSlug"
                        label="Slug"
                        required
                        description="Used in the post URL."
                        ><UInput
                            v-model="slug"
                            variant="soft"
                            class="w-full"
                            placeholder="post-slug"
                    /></UFormField>
                    <p v-else class="text-muted text-sm">
                        AI generates the slug when you publish or schedule. Published URLs are kept.
                    </p>
                </div>
                <UFormField
                    label="Tags"
                    description="Press Enter to add a tag. Remove a tag and enter it again to edit it."
                >
                    <UInputTags
                        :model-value="
                            values.tags.filter((tag): tag is string => typeof tag === 'string')
                        "
                        data-post-tags
                        duplicate
                        add-on-paste
                        :delimiter="/\r?\n/"
                        variant="soft"
                        class="w-full"
                        placeholder="Add a tag"
                        @update:model-value="
                            (value) =>
                                form.setFieldValue(
                                    'tags',
                                    value.filter(
                                        (tag): tag is string =>
                                            typeof tag === 'string' && Boolean(tag),
                                    ),
                                )
                        "
                    />
                </UFormField>
                <div class="flex flex-wrap items-end gap-3">
                    <UFormField
                        label="Publish at"
                        description="Time shown in your browser's time zone."
                    >
                        <UInput v-model="publishAt" type="datetime-local" variant="soft" />
                    </UFormField>
                    <UButton
                        label="Schedule Publish"
                        variant="outline"
                        color="neutral"
                        :loading="intent === 'schedule'"
                        :disabled="busy || conflict || !publishAt || awaitingProofreading"
                        @click="publish(true)"
                    />
                </div>
                <UFormField label="Image">
                    <UFileUpload
                        :model-value="null"
                        reset
                        accept="image/*"
                        label="Upload Image"
                        icon="mingcute:upload-3-fill"
                        :disabled="busy"
                        class="min-h-32 w-full"
                        @update:model-value="upload"
                    />
                    <UProgress
                        v-if="uploading"
                        :model-value="undefined"
                        aria-label="Upload progress"
                    />
                    <div v-if="values.image" class="mt-3 flex items-center gap-2">
                        <img
                            :src="values.image.url"
                            alt="Post image"
                            class="size-16 rounded-lg object-cover"
                        />
                        <span class="text-muted min-w-0 flex-1 truncate text-sm">{{
                            uploadedName || 'Post image'
                        }}</span>
                        <UButton
                            aria-label="Clear reference"
                            title="Remove image"
                            icon="mingcute:close-line"
                            variant="ghost"
                            color="neutral"
                            @click="form.setFieldValue('image', null)"
                        />
                    </div>
                </UFormField>
            </fieldset>
        </form>
    </AdminResourcePage>
</template>
