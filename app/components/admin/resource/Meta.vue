<script setup lang="ts">
const { label, value } = defineProps<{ label: string; value?: unknown }>()
</script>

<template>
    <span class="bg-default text-muted flex max-w-full gap-1 rounded-lg p-3 text-xs leading-none">
        {{ label }}:
        <span class="text-default min-w-0 font-mono wrap-break-word">{{ value ?? '—' }}</span>
    </span>
</template>
