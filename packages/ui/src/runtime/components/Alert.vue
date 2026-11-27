<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { UIcon } from '#components'

import { useUiIcons } from '../composables/icons'
import type { UiAlertTone } from '../types'

const {
    tone = 'error',
    role = 'alert',
    hideIcon = false,
} = defineProps<{
    tone?: UiAlertTone
    role?: 'alert' | 'status'
    hideIcon?: boolean
}>()

const root = useTemplateRef('root')
const icons = useUiIcons()

defineExpose({
    el: root,
    focus: () => root.value?.focus(),
})
</script>

<template>
    <div ref="root" class="ui-alert" :data-tone="tone" :role="role">
        <UIcon
            v-if="!hideIcon"
            :name="icons[tone]"
            class="ui-icon ui-alert-icon"
            aria-hidden="true"
        />
        <span class="ui-alert-content">
            <slot />
        </span>
    </div>
</template>
