<script setup lang="ts">
import {
    Dialog,
    DialogBackdrop,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@ui-sdk/vue/dialog'
import { useTemplateRef } from 'vue'

import { UIcon } from '#components'

import { useUiIcons } from '../composables/icons'
import type { DialogFinalFocus, DialogInitialFocus, UiDialogSize } from '../types'

const open = defineModel<boolean>('open', { required: true })

const {
    title,
    description,
    size = 'md',
    dismissible = true,
    closeOnOutsidePress = true,
    overflow = 'auto',
    form = false,
    initialFocus,
    finalFocus,
    closeLabel = 'Close',
    closeDisabled = false,
} = defineProps<{
    title: string
    description?: string
    size?: UiDialogSize
    dismissible?: boolean
    closeOnOutsidePress?: boolean
    overflow?: 'auto' | 'visible'
    form?: boolean
    initialFocus?: DialogInitialFocus
    finalFocus?: DialogFinalFocus
    closeLabel?: string
    closeDisabled?: boolean
}>()

const emit = defineEmits<{ submit: [] }>()

const container = useTemplateRef<HTMLElement>('container')
const icons = useUiIcons()

defineExpose({ container })
</script>

<template>
    <Dialog
        v-model:open="open"
        :dismissible="dismissible"
        :close-on-outside-press="closeOnOutsidePress"
    >
        <DialogBackdrop class="ui-dialog-backdrop" />
        <DialogContent
            class="ui-dialog"
            :data-size="size"
            :data-overflow="overflow"
            :initial-focus="initialFocus"
            :final-focus="finalFocus"
        >
            <component
                :is="form ? 'form' : 'div'"
                ref="container"
                class="ui-dialog-shell"
                :novalidate="form || undefined"
                @submit.prevent="form && emit('submit')"
            >
                <header class="ui-dialog-header">
                    <div class="ui-dialog-heading">
                        <DialogTitle class="ui-dialog-title">{{ title }}</DialogTitle>
                        <DialogDescription v-if="description" class="ui-dialog-description">
                            {{ description }}
                        </DialogDescription>
                    </div>
                    <DialogClose
                        class="ui-button ui-dialog-close"
                        data-variant="ghost"
                        data-color="neutral"
                        data-square="true"
                        :aria-label="closeLabel"
                        :disabled="closeDisabled"
                    >
                        <UIcon :name="icons.close" class="ui-icon ui-icon-md" aria-hidden="true" />
                    </DialogClose>
                </header>
                <div class="ui-dialog-body">
                    <slot />
                </div>
                <footer v-if="$slots.footer" class="ui-dialog-footer">
                    <slot name="footer" />
                </footer>
            </component>
            <slot name="overlays" />
        </DialogContent>
    </Dialog>
</template>
