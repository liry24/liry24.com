<script setup lang="ts">
import { useSelector } from '@tanstack/vue-form'

const props = defineProps<{ id?: string }>()
const saved = ref(false)
const uploading = ref(false)
const originalContent = ref('')
const uploadedName = ref('')
const editor = await useSiteAdminForm('posts', {
    ...(props.id ? { id: () => props.id } : {}),
    onSuccess: async () => {
        saved.value = true
        await navigateTo('/admin/posts')
    },
})
const { form, conflict, serverError, asset, ai, dirty, loading, loadError } = editor
const values = useSelector(form.atom, (state) => state.values)
const saving = useSelector(form.atom, (state) => state.isSubmitting)
const restored = ref(dirty.value)
const { slug } = editor.metadata
const manualSlug = computed({
    get: () => editor.metadata.modes.value.slug === 'manual',
    set: (value) => editor.metadata.setMode('slug', value ? 'manual' : 'auto'),
})
const manualExcerpt = computed({
    get: () => editor.metadata.modes.value.excerpt === 'manual',
    set: (value) => editor.metadata.setMode('excerpt', value ? 'manual' : 'auto'),
})
const content = computed(() => values.value.content)
const { proposal, stale: proposalStale } = ai
const proofreading = computed(() => ai.busy.value === 'proofread')
const busy = computed(
    () => saving.value || uploading.value || loading.value || ai.busy.value !== null,
)
const errorMessage = computed(() => {
    const cause =
        serverError.value || ai.error.value || loadError.value || editor.callbackError.value
    return cause instanceof Error ? cause.message : serverError.value?.message
})
const invalidProposal = computed(() =>
    Boolean(
        proposal.value && (proposal.value.issues.length || !proposal.value.data.content?.trim()),
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
    await form.handleSubmit()
}
function submit() {
    // Enter in the tag input adds a tag, including while confirming IME input.
    // Empty input must not trigger the form's implicit Save Draft action.
    if (document.activeElement?.matches('[data-post-tags]')) return
    void save()
}
async function proofread() {
    if (busy.value || !content.value.trim()) return
    originalContent.value = content.value
    await ai.proofread(['content'])
}
function applyProofreading() {
    if (busy.value || invalidProposal.value) return
    ai.apply()
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
                                class="bg-muted max-h-80 overflow-auto rounded-lg p-3 text-sm break-words whitespace-pre-wrap"
                                >{{ originalContent }}</pre>
                        </div>
                        <div>
                            <h3 class="text-muted mb-2 text-sm">Suggested</h3>
                            <pre
                                class="bg-muted max-h-80 overflow-auto rounded-lg p-3 text-sm break-words whitespace-pre-wrap"
                                >{{ proposal.data.content }}</pre>
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
                            @click="ai.discard"
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
                                @update:model-value="
                                    (value) => form.setFieldValue('excerpt', value)
                                "
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
