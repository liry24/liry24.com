<script setup lang="ts">
defineProps<{ label: string; value?: unknown }>()
</script>

<template>
    <span class="bg-muted rounded-lg px-2 py-1 text-xs">
        {{ label }}: <span class="font-mono">{{ value ?? '—' }}</span>
    </span>
</template>
