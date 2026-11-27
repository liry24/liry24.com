<script setup lang="ts">
const model = defineModel<string | undefined>()

const {
    label,
    error,
    required,
    disabled,
    description = 'Supports Markdown. Type / to insert formatting.',
    placeholder = 'Write Markdown…',
} = defineProps<{
    label: string
    error?: string
    required?: boolean
    disabled?: boolean
    description?: string
    placeholder?: string
}>()

const showPreview = ref(false)
const source = computed({
    get: () => model.value ?? '',
    set: (value: string) => {
        model.value = value || undefined
    },
})
</script>

<template>
    <UiField :label="label" :error="error" :required="required" :description="description">
        <UiCard v-if="showPreview" class="prose dark:prose-invert min-h-40 max-w-none p-3">
            <Markdown
                v-if="source.trim()"
                :value="source"
                :plugins="[postMarkdownSecurity]"
                class="min-w-0 text-sm leading-relaxed wrap-break-word *:first:mt-0 *:last:mb-0"
            />
            <p v-else class="text-muted text-sm">Nothing to preview.</p>
        </UiCard>
        <UiMarkdownEditor
            v-show="!showPreview"
            v-model="source"
            :placeholder="placeholder"
            :disabled="disabled"
            :required="required"
            compact
        />
        <div class="flex justify-end pt-1">
            <UiButton
                size="xs"
                variant="ghost"
                :disabled="disabled"
                @click="showPreview = !showPreview"
            >
                {{ showPreview ? 'Edit Markdown' : 'Preview Markdown' }}
            </UiButton>
        </div>
    </UiField>
</template>
