<script setup lang="ts">
defineProps<{ title: string; count?: number }>()
</script>

<template>
    <section class="grid gap-5 p-6">
        <header class="flex items-center gap-3">
            <h1 class="text-2xl font-semibold">{{ title }}</h1>
            <span class="text-muted">{{ count }}</span>
            <div class="ml-auto flex gap-2"><slot name="actions" /></div>
        </header>
        <slot />
    </section>
</template>
