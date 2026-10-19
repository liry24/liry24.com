<script setup lang="ts">
interface Props {
    src: string
    alt?: string
}
const { src, alt } = defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
    <UModal v-model:open="open" fullscreen :ui="{ content: 'bg-transparent' }">
        <template #content>
            <img
                :src
                :alt
                class="size-full max-h-full max-w-full object-contain"
                @click="open = false"
            />
        </template>
    </UModal>
</template>
