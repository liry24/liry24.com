<script setup lang="ts">
import { FileInputTrigger } from '@ui-sdk/vue/file-input'

import type { UiButtonColor, UiButtonSize, UiButtonVariant } from '../types'

const {
    variant = 'outline',
    color = 'neutral',
    size = 'md',
} = defineProps<{
    variant?: UiButtonVariant
    color?: UiButtonColor
    size?: UiButtonSize
}>()
</script>

<template>
    <FileInputTrigger
        class="ui-button"
        :data-variant="variant"
        :data-color="color"
        :data-size="size"
    >
        <slot />
    </FileInputTrigger>
</template>
