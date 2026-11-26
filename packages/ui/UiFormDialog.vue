<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle } from '@ui-sdk/vue/dialog'
import { useTemplateRef } from 'vue'

const open = defineModel<boolean>('open', { required: true })
defineProps<{
    title: string
    busy?: boolean
    saving?: boolean
    wide?: boolean
    finalFocus?: () => HTMLElement | null
}>()
defineEmits<{ submit: [] }>()
const form = useTemplateRef('form')
const initialFocus = () =>
    form.value?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)',
    ) ?? null
</script>

<template>
    <Dialog v-model:open="open" :dismissible="!busy" :close-on-outside-press="false">
        <DialogBackdrop class="ui-dialog-backdrop" />
        <DialogContent
            class="ui-dialog"
            :data-wide="wide || undefined"
            :initial-focus="initialFocus"
            :final-focus="finalFocus"
        >
            <form ref="form" class="ui-dialog-form" novalidate @submit.prevent="$emit('submit')">
                <header class="ui-dialog-header">
                    <DialogTitle class="ui-dialog-title">{{ title }}</DialogTitle>
                    <DialogClose
                        class="ui-button ui-dialog-close"
                        data-variant="ghost"
                        aria-label="Close"
                        :disabled="busy"
                        >×</DialogClose
                    >
                </header>
                <div class="ui-dialog-body">
                    <slot />
                </div>
                <footer class="ui-dialog-footer">
                    <DialogClose class="ui-button" data-variant="ghost" :disabled="busy">
                        Cancel
                    </DialogClose>
                    <Button type="submit" class="ui-button" data-variant="primary" :disabled="busy">
                        {{ saving ? 'Saving…' : 'Save draft' }}
                    </Button>
                </footer>
            </form>
            <slot name="overlays" />
        </DialogContent>
    </Dialog>
</template>
