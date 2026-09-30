<script setup lang="ts">
interface Props {
    title: string
    icon: string
    collapsed?: boolean
}

const props = defineProps<Props>()
</script>

<template>
    <div class="grid gap-1">
        <div class="flex items-center gap-1 pl-2">
            <Icon v-if="props.collapsed" :name="props.icon" class="text-muted size-3.5" />
            <span v-else class="text-muted text-[0.8rem]">{{ props.title }}</span>
        </div>

        <slot />
    </div>
</template>
