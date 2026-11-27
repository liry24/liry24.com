<script setup lang="ts">
import { DialogClose } from '@ui-sdk/vue/dialog'
import { useTemplateRef } from 'vue'

import type { DialogFinalFocus } from '../types'
import UiButton from './Button.vue'
import UiDialog from './Dialog.vue'

const open = defineModel<boolean>('open', { required: true })

const {
    title,
    description,
    busy = false,
    saving = false,
    wide = false,
    finalFocus,
    submitLabel = 'Save',
    submittingLabel = 'Saving…',
    cancelLabel = 'Cancel',
    hideSubmit = false,
} = defineProps<{
    title: string
    description?: string
    busy?: boolean
    saving?: boolean
    wide?: boolean
    finalFocus?: DialogFinalFocus
    submitLabel?: string
    submittingLabel?: string
    cancelLabel?: string
    hideSubmit?: boolean
}>()

const emit = defineEmits<{ submit: [] }>()

const dialog = useTemplateRef('dialog')
const initialFocus = () =>
    dialog.value?.container?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)',
    ) ?? null
</script>

<template>
    <UiDialog
        ref="dialog"
        v-model:open="open"
        :title="title"
        :description="description"
        :size="wide ? 'wide' : 'md'"
        :dismissible="!busy"
        :close-on-outside-press="false"
        :close-disabled="busy"
        :initial-focus="initialFocus"
        :final-focus="finalFocus"
        form
        @submit="emit('submit')"
    >
        <slot />
        <template #footer>
            <DialogClose
                class="ui-button"
                data-variant="ghost"
                data-color="neutral"
                :disabled="busy"
            >
                {{ cancelLabel }}
            </DialogClose>
            <UiButton
                v-if="!hideSubmit"
                type="submit"
                variant="solid"
                color="primary"
                :disabled="busy"
            >
                {{ saving ? submittingLabel : submitLabel }}
            </UiButton>
        </template>
        <template v-if="$slots.overlays" #overlays>
            <slot name="overlays" />
        </template>
    </UiDialog>
</template>
