<script setup lang="ts">
import { UiFormDialog, UiSearchPicker } from '@liry24/ui'
import { fieldErrors, submitForm } from 'vite-hub/forms/client'

import '@liry24/ui/styles.css'

const props = defineProps<{
    model: PortfolioCollectionName
    item?: AdminEntryRecord
    finalFocus: () => HTMLElement | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const toast = useToast()
const form = computed(() => adminEntryForms[props.model])
const data = ref<AdminEntryData>({})
const saving = ref(false)
const uploading = ref(false)
const busy = computed(() => saving.value || uploading.value)
const errors = ref<Record<string, string>>({})
const formError = ref('')
const summary = useTemplateRef('summary')
const stats = useTemplateRef('stats')
const manualSlug = ref(false)
const slugKey = computed(() => (props.model === 'gameStats' ? 'periodKey' : 'slug'))
const slugLabel = computed(() => (props.model === 'gameStats' ? 'Period key' : 'Slug'))
const iconOpen = ref(false)
const iconTrigger = shallowRef<HTMLElement | null>(null)
const loadIcons = useAdminIconSearch(() => iconOpen.value)
const hasIcon = computed(() => ['works', 'skills', 'socials'].includes(props.model))
const title = computed(() => (props.item ? `Edit ${form.value.label}` : `New ${form.value.label}`))

watch(open, (value) => {
    if (value) {
        data.value = { ...props.item?.data }
        manualSlug.value = false
        if (props.model === 'works') data.value.style ??= 'small'
        errors.value = {}
        formError.value = ''
    } else iconOpen.value = false
})

function openIcon(event: MouseEvent) {
    iconTrigger.value = event.currentTarget as HTMLButtonElement | null
    iconOpen.value = true
}

async function showErrors(message: string, fields: Record<string, string> = {}) {
    formError.value = message
    errors.value = fields
    await nextTick()
    const invalid = summary.value
        ?.closest('form')
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (invalid) {
        const details = invalid.closest('details')
        if (details) details.open = true
        invalid.focus()
        if (document.activeElement === invalid) return
    }
    summary.value?.focus()
}

async function save() {
    if (busy.value) return
    formError.value = ''
    errors.value = {}
    const payload = { ...data.value }
    const key = slugKey.value
    if (manualSlug.value) {
        const value = payload[key]?.trim()
        if (!value) {
            await showErrors('Check the highlighted fields.', {
                [`data.${key}`]: `Enter a ${slugLabel.value.toLowerCase()}.`,
            })
            return
        }
        payload[key] = value
    } else delete payload[key]

    if (props.model === 'works' || props.model === 'arts' || props.model === 'gameStats')
        payload.href = payload.href?.trim() || undefined

    if (props.model === 'gameStats') {
        const result = stats.value?.getValues()
        if (!result || Object.keys(result.errors).length) {
            await showErrors('Check the highlighted fields.', result?.errors)
            return
        }
        payload.values = result.values
    }
    const parsed = form.value.schema.safeParse(payload)
    if (!parsed.success) {
        await showErrors(
            'Check the highlighted fields.',
            Object.fromEntries(
                parsed.error.issues.map((issue) => [`data.${issue.path.join('.')}`, issue.message]),
            ),
        )
        return
    }
    saving.value = true
    let failed: { message: string; fields?: Record<string, string> } | undefined
    try {
        const submission = props.item
            ? { data: parsed.data, id: props.item.id }
            : { data: parsed.data }
        const [error] = await submitForm(form.value.endpoint, submission)
        if (error) failed = { message: error.message, fields: fieldErrors(error) }
    } catch (error) {
        failed = { message: adminErrorMessage(error, 'Could not save draft.') }
    } finally {
        saving.value = false
    }
    if (failed) {
        await showErrors(failed.message, failed.fields)
        return
    }
    toast.add({ title: 'Saved draft', color: 'success' })
    open.value = false
    emit('saved')
}
</script>

<template>
    <UiFormDialog
        v-model:open="open"
        :title="title"
        :busy="busy"
        :saving="saving"
        :wide="model === 'works' || model === 'arts' || model === 'gameStats'"
        :final-focus="finalFocus"
        @submit="save"
    >
        <p v-if="formError" ref="summary" class="ui-alert mb-4 w-full" role="alert" tabindex="-1">
            {{ formError }}
        </p>
        <fieldset v-if="open" :disabled="busy" class="min-w-0">
            <AdminEntryWorkFields
                v-if="model === 'works'"
                v-model="data"
                :errors="errors"
                :busy="busy"
                @busy="uploading = $event"
                @search="openIcon"
            />
            <AdminEntryArtFields
                v-else-if="model === 'arts'"
                v-model="data"
                :errors="errors"
                :busy="busy"
                @busy="uploading = $event"
            />
            <AdminEntryCareerFields
                v-else-if="model === 'careers'"
                v-model="data"
                :errors="errors"
            />
            <AdminEntrySkillFields
                v-else-if="model === 'skills'"
                v-model="data"
                :errors="errors"
                @search="openIcon"
            />
            <AdminEntrySocialFields
                v-else-if="model === 'socials'"
                v-model="data"
                :errors="errors"
                @search="openIcon"
            />
            <AdminEntryGameStatsFields
                v-else
                ref="stats"
                v-model="data"
                :errors="errors"
                :busy="busy"
                @busy="uploading = $event"
            />
            <AdminEntrySlug
                v-model="data[slugKey]"
                v-model:manual="manualSlug"
                :label="slugLabel"
                :name="`data.${slugKey}`"
                :error="errors[`data.${slugKey}`]"
                class="mt-5"
            />
        </fieldset>
        <template #overlays>
            <UiSearchPicker
                v-if="hasIcon"
                v-model:open="iconOpen"
                title="Choose an icon"
                label="Search Iconify icons"
                :load="loadIcons"
                :final-focus="() => iconTrigger"
                @select="data.icon = $event"
            >
                <template #item="{ value }">
                    <Icon :name="value" class="shrink-0 text-lg" aria-hidden="true" />
                    <span>{{ value }}</span>
                </template>
            </UiSearchPicker>
        </template>
    </UiFormDialog>
</template>
