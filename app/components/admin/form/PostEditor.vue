<script setup lang="ts">
import { serializeSiteAdminData } from '@liria24/site-admin/client'
import { useSelector } from '@tanstack/vue-form'
import { postMetadataModes, postPublicationSettings } from '~~/shared/utils/postEditorial'

import type { PostEditorialProposal, PostMetadataInput } from '~/utils/postEditorialFlow'
import {
    postProposalStale,
    preparePostProofreading,
    preparePostPublication,
} from '~/utils/postEditorialFlow'

const props = defineProps<{ id?: string }>()
const saved = ref(false)
const savePending = ref(false)
const intent = ref<'proofread' | 'publish' | 'schedule' | null>(null)
const localError = ref('')
const publishAt = ref('')
const uploading = ref(false)
const uploadedName = ref('')
const editor = await useSiteAdminForm('posts', {
    ...(props.id ? { id: () => props.id } : {}),
    ...(!props.id ? { defaultValues: { publication: { slug: 'auto', excerpt: 'auto' } } } : {}),
    onSuccess: async () => {
        if (intent.value) return
        saved.value = true
        await navigateTo('/admin/posts')
        if (!props.id) delete editor.drafts[newDraftIdentity]
    },
})
const { form, conflict, serverError, asset, dirty, loading, loadError } = editor
const newDraftIdentity = editor.identity.value
// AI actions first create a draft while the browser is still on /new. Keep
// that route's session input pointing at the created entry until navigation.
watchEffect(
    () => {
        if (props.id || !editor.entryId.value || saved.value) return
        const current = editor.drafts[editor.identity.value]
        if (current) editor.drafts[newDraftIdentity] = current
    },
    { flush: 'sync' },
)
const values = useSelector(form.atom, (state) => state.values)
const saving = useSelector(form.atom, (state) => state.isSubmitting)
const restored = ref(dirty.value)
const { slug } = editor.metadata
function setMetadataMode(field: 'slug' | 'excerpt', manual: boolean) {
    const settings = postPublicationSettings(values.value)
    form.setFieldValue('publication', { ...settings, [field]: manual ? 'manual' : 'auto' })
    if (field === 'slug' && !manual && settings.publishedSlug) slug.value = settings.publishedSlug
}
const manualSlug = computed({
    get: () => postMetadataModes(values.value).slug === 'manual',
    set: (value) => setMetadataMode('slug', value),
})
const manualExcerpt = computed({
    get: () => postMetadataModes(values.value).excerpt === 'manual',
    set: (value) => setMetadataMode('excerpt', value),
})
const content = computed(() => values.value.content)
const management = useSiteAdminManagementClient()
const proposal = shallowRef<PostEditorialProposal | null>(null)
const originalContent = computed(() => String(proposal.value?.snapshot.draft.data.content ?? ''))
const aiError = shallowRef<Error | null>(null)
const proofreadInput = shallowRef({ content: '' })
const publicationInput = shallowRef<PostMetadataInput>({
    title: '',
    content: '',
    generateSlug: false,
    generateExcerpt: false,
})
const proofreadAction = await useAiAction('proofread', {
    props: () => proofreadInput.value,
    immediate: false,
})
const publicationAction = await useAiAction('publication', {
    props: () => publicationInput.value,
    immediate: false,
})
function currentDraft() {
    return {
        entryId: editor.entryId.value,
        version: editor.version.value,
        draft: {
            data: serializeSiteAdminData(editor.descriptor.value, values.value),
            slug: slug.value,
        },
    }
}
const proposalStale = computed(() =>
    proposal.value ? postProposalStale(proposal.value, currentDraft()) : false,
)
function discardSuggestion() {
    proposal.value = null
    aiError.value = null
    proofreadAction.clear()
    publicationAction.clear()
}
const proofreading = computed(() => intent.value === 'proofread')
const busy = computed(
    () =>
        savePending.value ||
        saving.value ||
        uploading.value ||
        loading.value ||
        intent.value !== null ||
        proofreadAction.status.value === 'pending' ||
        publicationAction.status.value === 'pending' ||
        editor.publishBusy.value,
)
const awaitingProofreading = computed(() => proposal.value?.kind === 'proofread')
const errorMessage = computed(() => {
    if (localError.value) return localError.value
    const cause =
        serverError.value || aiError.value || loadError.value || editor.callbackError.value
    return cause instanceof Error ? cause.message : serverError.value?.message
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
    if (busy.value || conflict.value || loadError.value) return
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
    if (editor.entryId.value) return true
    await form.handleSubmit()
    return !serverError.value && Boolean(editor.entryId.value)
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
    if (busy.value || conflict.value || loadError.value || !content.value.trim()) return
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
    if (busy.value || conflict.value || loadError.value || awaitingProofreading.value) return
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
    let beforePublication: ReturnType<typeof postPublicationSettings> | undefined
    let committed = false
    try {
        if (!(await ensureDraft())) return
        const candidate = await preparePostPublication(
            { management, current: currentDraft },
            async (props) => {
                publicationInput.value = props
                await publicationAction.execute()
                if (publicationAction.error.value) throw publicationAction.error.value
                if (!publicationAction.data.value)
                    throw new Error('No publication suggestion was returned.')
                return publicationAction.data.value
            },
        )
        if (!manualExcerpt.value)
            form.setFieldValue('excerpt', String(candidate.data.excerpt ?? ''))
        if (!manualSlug.value) slug.value = candidate.slug
        beforePublication = postPublicationSettings(values.value)
        if (slug.value)
            form.setFieldValue('publication', { ...beforePublication, publishedSlug: slug.value })
        const result = at ? await editor.schedule(at) : await editor.publish()
        if (!result) return
        committed = true
        saved.value = true
        await navigateTo('/admin/posts')
        if (!props.id) delete editor.drafts[newDraftIdentity]
    } catch (error) {
        aiError.value = actionFailure(error, 'Publication failed. Your draft is kept.')
    } finally {
        if (!committed && beforePublication) form.setFieldValue('publication', beforePublication)
        intent.value = null
    }
}
async function upload(files: File | File[] | null | undefined) {
    if (!files || busy.value) return
    const file = Array.isArray(files) ? files[0] : files
    if (!file) return
    uploading.value = true
    try {
        const uploaded = await asset.upload(file)
        asset.set('image', uploaded)
        uploadedName.value = file.name
    } catch {
        // The published Site Admin upload controller exposes the failure.
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
                :disabled="busy || conflict || Boolean(loadError)"
            />
            <UButton
                label="Publish"
                icon="mingcute:upload-3-fill"
                color="neutral"
                :loading="intent === 'publish'"
                :disabled="busy || conflict || Boolean(loadError) || awaitingProofreading"
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
                                description="Write in Markdown."
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
                                :options="{ registerDefaultPlugins: false }"
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
                <div class="grid gap-6 lg:grid-cols-2">
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
                            AI generates the slug when you publish or schedule. Published URLs are
                            kept.
                        </p>
                    </div>
                    <div class="grid content-start gap-3">
                        <UCheckbox v-model="manualExcerpt" label="Enter excerpt manually" />
                        <UFormField v-if="manualExcerpt" label="Excerpt"
                            ><UTextarea
                                :model-value="String(values.excerpt ?? '')"
                                variant="soft"
                                class="w-full"
                                :rows="3"
                                autoresize
                                @update:model-value="
                                    (value) => form.setFieldValue('excerpt', value)
                                "
                        /></UFormField>
                        <p v-else class="text-muted text-sm">
                            AI writes a short introduction when you publish.
                        </p>
                    </div>
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
                        :disabled="
                            busy ||
                            conflict ||
                            Boolean(loadError) ||
                            !publishAt ||
                            awaitingProofreading
                        "
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
                        v-if="uploading && asset.progress.value !== null"
                        :model-value="asset.progress.value * 100"
                        aria-label="Upload progress"
                    />
                    <p v-if="asset.error.value" class="text-error mt-2 text-sm" role="alert">
                        {{ asset.error.value }}
                    </p>
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
                            @click="asset.clear('image')"
                        />
                    </div>
                </UFormField>
            </fieldset>
        </form>
    </AdminResourcePage>
</template>
