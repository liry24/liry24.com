<script setup lang="ts">
import type { SiteAdminFormModels } from '@liria24/site-admin/internal/client'
import type { UseEntryFormOptions } from '@liria24/site-admin/internal/form'
const { id, composerId } = defineProps<{ id?: string; composerId?: string }>()
const { locale } = useI18n()
const publishAt = ref('')
const uploadedName = ref('')
const { post: composerProposal, scope: composerScope, saved } = useAdminComposer()

const options: UseEntryFormOptions<SiteAdminFormModels['posts']> = {
    beforeUnload: (): boolean => busy.value,
    defaultValues: { publication: { slug: !id ? 'auto' : undefined } },
    onBeforeSubmit: ({ operation }) => {
        if (operation !== 'save' && proposal.value)
            throw new Error('Apply or discard the proofreading suggestion before publishing.')
    },
    onUpload: ({ files }) => {
        uploadedName.value = files[0]?.name ?? ''
    },
    onSuccess: async () => {
        if (composerId) saved.value[composerId] = true
        await navigateTo('/admin/posts')
    },
}
const resource = composerId
    ? useComposerForm<SiteAdminFormModels['posts']>('posts', composerId, {
          ...options,
          editor: true,
      })
    : useAdminForm('posts', { ...options, id: () => id })
const { form, draft, publish, schedule, upload, operation, status, error } = await resource

const conflict = computed(() => error.value?.data?.code === 'SITE_ADMIN_CONFLICT')
const restored = ref(draft.isDirty.value)
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
        form.setFieldValue('title', proposal.values.title)
    if (Array.isArray(proposal.values.tags)) form.setFieldValue('tags', proposal.values.tags)
    publishAt.value = proposal.publishAt
    composerProposal.value = null
}
if (!restored.value) applyComposer()
const {
    error: editorialError,
    proposal,
    originalContent,
    running: proofreading,
    stale: proposalStale,
    invalid: invalidProposal,
    discard: discardSuggestion,
    run: proofread,
    apply: applyProofreading,
} = usePostProofreading(form, {
    identity: () => [id, locale.value],
    blocked: () => operation.value !== null || status.value === 'pending' || conflict.value,
})
const busy = computed(
    () => operation.value !== null || proofreading.value || status.value === 'pending',
)
const awaitingProofreading = computed(() => Boolean(proposal.value))
const errorMessage = computed(() => (error.value || editorialError.value)?.message)

const setManualSlug = (manual: boolean) => {
    const settings = postPublicationSettings(form.state.values)
    form.setFieldValue('publication', { ...settings, slug: manual ? 'manual' : 'auto' })
    if (!manual && settings.publishedSlug) form.setFieldValue('slug', settings.publishedSlug)
}

const submit = () => {
    if (!busy.value && !conflict.value && !document.activeElement?.matches('[data-post-tags]'))
        void form.handleSubmit()
}

onBeforeRouteLeave(() => {
    if (busy.value) return false
})
</script>

<template>
    <form.Subscribe
        :selector="(state) => ({ values: state.values, saving: state.isSubmitting })"
        v-slot="{ values, saving }"
    >
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
                    :loading="operation === 'publish'"
                    :disabled="busy || conflict || awaitingProofreading"
                    @click="publish()"
                />
            </template>
            <UAlert
                v-if="pendingComposer"
                title="A prepared post is available"
                :description="
                    String(
                        pendingComposer.values.title ??
                            'Review the prepared title, tags and publication time.',
                    )
                "
                color="neutral"
            >
                <template #actions>
                    <UButton
                        label="Apply prepared values"
                        :disabled="busy"
                        @click="applyComposer"
                    />
                    <UButton
                        label="Keep existing input"
                        variant="outline"
                        @click="composerProposal = null"
                    />
                </template>
            </UAlert>
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
                                    @update:model-value="
                                        (value) => form.setFieldValue('title', value)
                                    "
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
                                    :value="values.content"
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
                            :disabled="busy || !values.content.trim()"
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
                                    >{{ proposal?.content }}</pre>
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
                        <UCheckbox
                            :model-value="postPublicationSettings(values).slug === 'manual'"
                            @update:model-value="(value) => setManualSlug(value === true)"
                            label="Enter slug manually"
                        />
                        <UFormField
                            v-if="postPublicationSettings(values).slug === 'manual'"
                            label="Slug"
                            required
                            description="Used in the post URL."
                            ><UInput
                                :model-value="values.slug ?? undefined"
                                @update:model-value="(value) => form.setFieldValue('slug', value)"
                                variant="soft"
                                class="w-full"
                                placeholder="post-slug"
                        /></UFormField>
                        <p v-else class="text-muted text-sm">
                            AI generates the slug when you publish or schedule. Published URLs are
                            kept.
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
                            :loading="operation === 'schedule'"
                            :disabled="busy || conflict || !publishAt || awaitingProofreading"
                            @click="schedule(publishAt)"
                        />
                    </div>
                    <UFormField label="Image">
                        <!-- @vue-generic {false, File} -->
                        <UFileUpload
                            :model-value="null"
                            reset
                            accept="image/*"
                            label="Upload Image"
                            icon="mingcute:upload-3-fill"
                            :disabled="busy"
                            class="min-h-32 w-full"
                            @update:model-value="(files) => upload('image', files)"
                        />
                        <UProgress
                            v-if="operation === 'upload'"
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
    </form.Subscribe>
</template>
