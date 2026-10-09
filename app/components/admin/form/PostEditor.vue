<script setup lang="ts">
import type { ModelDescriptor } from '@liria24/site-admin'
import { managementAssetUrl } from '@liria24/site-admin/client'
import { useSiteAdminForm } from '@liria24/site-admin/form'
import type { EntryRecord } from '@liria24/site-admin/server'

import type { PostEditorAI, PostEditorDraft } from '~/utils/postEditor'

const props = defineProps<{ descriptor: ModelDescriptor; entry?: EntryRecord; ai?: PostEditorAI }>()
const { user } = useUserSession()
const drafts = useState<Record<string, PostEditorDraft>>(
    `post-editor:${user.value?.id}`,
    () => ({}),
)
const draftKey = props.entry?.id || 'new'
const draft = drafts.value[draftKey]
const restored = ref(Boolean(draft))
const slug = ref(draft?.slug ?? props.entry?.slug ?? '')
const manualSlug = ref(draft?.manualSlug ?? Boolean(props.entry))
const manualExcerpt = ref(draft?.manualExcerpt ?? Boolean(props.entry))
const saving = ref(false)
const saved = ref(false)
const uploading = ref(false)
const proofreading = ref(false)
const localError = ref('')
const proposal = ref<{ original: string; content: string } | null>(null)
const uploadedName = ref('')
const busy = computed(() => saving.value || uploading.value || proofreading.value)
const { form, conflict, serverError, asset } = useSiteAdminForm({
    modelName: 'posts',
    descriptor: props.descriptor,
    entry: props.entry ? { ...props.entry, data: draft?.data ?? props.entry.data } : undefined,
    defaultValues: draft?.data,
    get slug() {
        return manualSlug.value ? slug.value : slug.value || undefined
    },
    onSuccess: async () => {
        saved.value = true
        dirty.value = false
        delete drafts.value[draftKey]
        await refreshNuxtData('admin:posts')
        await navigateTo('/admin/posts')
    },
})
const values = ref<Record<string, unknown>>({ ...form.state.values })
const staleDraft = computed(() =>
    Boolean(draft && draft.version !== (props.entry?.version ?? null)),
)
const content = computed(() => String(values.value.content ?? ''))
const proposalStale = computed(() => proposal.value?.original !== content.value)
const dirty = ref(Boolean(draft))

function remember() {
    if (saved.value) return
    dirty.value = true
    drafts.value[draftKey] = {
        data: postEditorSnapshot(values.value),
        slug: slug.value,
        manualSlug: manualSlug.value,
        manualExcerpt: manualExcerpt.value,
        version: draft?.version ?? props.entry?.version ?? null,
    }
}
function change(name: string, value: unknown) {
    form.setFieldValue(name, value)
    values.value = { ...form.state.values }
    remember()
}
watch([slug, manualSlug, manualExcerpt], remember)
onBeforeRouteLeave(() => {
    if (busy.value && !saved.value) return false
})
useEventListener('beforeunload', (event) => {
    if (!dirty.value && !busy.value) return
    event.preventDefault()
    event.returnValue = ''
})

async function save() {
    if (busy.value || conflict.value || staleDraft.value) return
    localError.value = ''
    if (!String(values.value.title ?? '').trim() || !content.value.trim()) {
        localError.value = 'Title and content are required.'
        return
    }
    saving.value = true
    try {
        const fields = postEditorAIFields(manualSlug.value, manualExcerpt.value)
        if (fields.length) {
            if (!props.ai)
                throw new Error(
                    'AI is unavailable. Your input is kept. You can enter slug and excerpt manually to save.',
                )
            const generated = await props.ai.generate({
                data: postEditorSnapshot(values.value),
                fields,
                ...(manualSlug.value ? { slug: slug.value } : {}),
            })
            if (fields.includes('slug') && !generated.slug?.trim())
                throw new Error('AI did not return a slug. Please try again.')
            if (fields.includes('excerpt') && !generated.excerpt?.trim())
                throw new Error('AI did not return an excerpt. Please try again.')
            if (fields.includes('slug')) slug.value = generated.slug!
            if (fields.includes('excerpt')) change('excerpt', generated.excerpt!)
        }
        await form.handleSubmit()
    } catch (error) {
        localError.value =
            error instanceof Error ? error.message : 'Save failed. Your input is kept.'
    } finally {
        saving.value = false
    }
}
function submit() {
    // Enter in the tag input adds a tag, including while confirming IME input.
    // Empty input must not trigger the form's implicit Save Draft action.
    if (document.activeElement?.matches('[data-post-tags]')) return
    void save()
}
async function proofread() {
    if (busy.value || !content.value.trim()) return
    localError.value = ''
    proofreading.value = true
    const original = content.value
    try {
        if (!props.ai) throw new Error('AI proofreading is unavailable. Your content is kept.')
        const result = await props.ai.proofread({ data: postEditorSnapshot(values.value) })
        if (!result.content.trim()) throw new Error('AI returned empty content. Please try again.')
        proposal.value = { original, content: result.content }
    } catch (error) {
        localError.value =
            error instanceof Error ? error.message : 'Proofreading failed. Your content is kept.'
    } finally {
        proofreading.value = false
    }
}
function applyProofreading() {
    if (!proposal.value || proposalStale.value || busy.value) return
    change('content', proposal.value.content)
    proposal.value = null
}
async function upload(files: File | File[] | null | undefined) {
    if (!files || busy.value) return
    const file = Array.isArray(files) ? files[0] : files
    if (!file) return
    uploading.value = true
    try {
        const uploaded = await asset.upload(file)
        change('image', uploaded.id)
        uploadedName.value = file.name
    } catch {
        // The published Site Admin upload controller exposes the failure.
    } finally {
        uploading.value = false
    }
}
</script>

<template>
    <AdminResourcePage :title="entry ? 'Edit Post' : 'New Post'" icon="mingcute:book-3-fill">
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
                :disabled="busy || conflict || staleDraft"
            />
        </template>
        <UAlert
            v-if="restored"
            title="Unsaved input restored"
            description="Input is kept while you move between pages in this session. Save your draft before closing or reloading this tab."
            color="neutral"
        />
        <UAlert
            v-if="conflict || staleDraft"
            title="Conflict detected"
            description="Your input is kept. Open the latest entry in another tab and compare your changes before saving."
            color="warning"
        />
        <UAlert
            v-if="serverError || localError"
            :title="localError || serverError?.message"
            color="error"
        />
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
                                @update:model-value="(value) => change('title', value)"
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
                                    @update:model-value="(value) => change('content', value)"
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
                                class="sentence break-words *:first:mt-0 *:last:mb-0"
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
                    v-if="proposal"
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
                    <div class="grid min-w-0 gap-4 lg:grid-cols-2">
                        <div>
                            <h3 class="text-muted mb-2 text-sm">Original</h3>
                            <pre
                                class="bg-muted max-h-80 overflow-auto rounded-lg p-3 text-sm break-words whitespace-pre-wrap"
                                >{{ proposal.original }}</pre>
                        </div>
                        <div>
                            <h3 class="text-muted mb-2 text-sm">Suggested</h3>
                            <pre
                                class="bg-muted max-h-80 overflow-auto rounded-lg p-3 text-sm break-words whitespace-pre-wrap"
                                >{{ proposal.content }}</pre>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <UButton
                            label="Apply Suggestion"
                            color="neutral"
                            :disabled="busy || proposalStale"
                            @click="applyProofreading"
                        />
                        <UButton
                            label="Discard Suggestion"
                            variant="ghost"
                            color="neutral"
                            @click="proposal = null"
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
                            AI generates the slug when you save the draft.
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
                                @update:model-value="(value) => change('excerpt', value)"
                        /></UFormField>
                        <p v-else class="text-muted text-sm">
                            AI generates the excerpt when you save the draft.
                        </p>
                    </div>
                </div>
                <UFormField
                    label="Tags"
                    description="Press Enter to add a tag. Remove a tag and enter it again to edit it."
                >
                    <UInputTags
                        :model-value="Array.isArray(values.tags) ? values.tags : []"
                        data-post-tags
                        duplicate
                        add-on-paste
                        :delimiter="/\r?\n/"
                        variant="soft"
                        class="w-full"
                        placeholder="Add a tag"
                        @update:model-value="(value) => change('tags', value.filter(Boolean))"
                    />
                </UFormField>
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
                    <div v-if="adminAssetId(values.image)" class="mt-3 flex items-center gap-2">
                        <img
                            :src="managementAssetUrl(adminAssetId(values.image)!)"
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
                            @click="change('image', null)"
                        />
                    </div>
                </UFormField>
            </fieldset>
        </form>
    </AdminResourcePage>
</template>
