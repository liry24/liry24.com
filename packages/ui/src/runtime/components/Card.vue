<script setup lang="ts">
const { as = 'div' } = defineProps<{
    as?: 'div' | 'section' | 'article'
}>()
</script>

<template>
    <component :is="as" class="ui-card">
        <slot />
    </component>
</template>
