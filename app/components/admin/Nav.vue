<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

interface Props {
    links?: NavigationMenuItem[]
    collapsed?: boolean
}

const props = defineProps<Props>()
</script>

<template>
    <UNavigationMenu
        :collapsed="props.collapsed"
        :items="props.links?.map((link) => ({ ...link, 'aria-label': link.label }))"
        orientation="vertical"
        tooltip
        popover
        color="neutral"
        :ui="{
            link: 'gap-2.5 text-toned tracking-wide',
            linkLeadingIcon: 'size-4.25 text-toned',
        }"
    >
        <template v-for="(_, name) in $slots" #[name]="slotData">
            <slot :name v-bind="slotData" />
        </template>
    </UNavigationMenu>
</template>
