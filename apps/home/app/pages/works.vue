<script setup lang="ts">
import { MasonryWall } from '@yeger/vue-masonry-wall'

const { data } = useFetch('/api/works')

defineSeo({
    title: 'Works',
    titleTemplate: '%s | Liry24',
})
</script>

<template>
    <UPage v-if="data" :ui="{ center: 'grid gap-8' }">
        <MasonryWall
            :items="data"
            :column-width="240"
            :gap="24"
            :min-columns="1"
            :max-columns="4"
            :ssr-columns="2"
        >
            <template #default="{ item }">
                <UModal
                    scrollable
                    :title="item.title"
                    :ui="{
                        content:
                            'max-w-full h-[calc(100dvh-4rem)] w-[calc(100dvw-4rem)] rounded-4xl',
                    }"
                >
                    <UCard
                        variant="soft"
                        :ui="{ body: 'flex flex-col gap-3 p-2 sm:p-2' }"
                        class="rounded-3xl shadow-xl"
                    >
                        <NuxtImg
                            v-if="item.image"
                            :src="item.image"
                            :alt="item.title"
                            class="rounded-xl"
                        />

                        <h2 class="mx-2 mb-1 font-medium">{{ item.title }}</h2>
                    </UCard>

                    <template #content> </template>
                </UModal>
            </template>
        </MasonryWall>
    </UPage>
</template>
