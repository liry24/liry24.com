<script setup lang="ts">
import { Button } from '@ui-sdk/vue/button'

import type { UiButtonColor, UiButtonSize, UiButtonVariant } from '../types'

const {
    variant = 'outline',
    color = 'neutral',
    size = 'md',
    square = false,
    type = 'button',
    disabled = false,
} = defineProps<{
    variant?: UiButtonVariant
    color?: UiButtonColor
    size?: UiButtonSize
    square?: boolean
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
}>()
</script>

<template>
    <Button
        :type="type"
        :disabled="disabled"
        class="ui-button"
        :data-variant="variant"
        :data-color="color"
        :data-size="size"
        :data-square="square || undefined"
    >
        <slot />
    </Button>
</template>
