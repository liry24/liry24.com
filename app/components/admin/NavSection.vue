<script setup lang="ts">
interface Props {
    title: string
    icon: string
    collapsed?: boolean
}
const { title, icon, collapsed } = defineProps<Props>()
</script>

<template>
    <div class="grid gap-1">
        <div class="flex items-center gap-1 pl-2">
            <Icon v-if="collapsed" :name="icon" class="text-muted size-3.5" />
            <span v-else class="text-muted text-[0.8rem]">{{ title }}</span>
        </div>

        <slot />
    </div>
</template>
