<script setup lang="ts">
import { MasonryWall } from '@yeger/vue-masonry-wall'

useSeoMeta({ title: 'Works', description: 'A collection of works by Liry24.' })
defineOgImage('Home.takumi', { title: 'Liry24', subpath: 'works' }, [
    { key: 'og' },
    { key: 'whatsapp', width: 800, height: 800 },
])

const entries = await usePortfolioQuery('works')
const data = computed(() =>
    (entries.data.value ?? []).map((entry) => ({
        ...entry.data,
        slug: entry.data.slug,
        image: mediaUrl(entry.data.image),
    })),
)
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
                <component
                    :is="item.href ? 'a' : 'div'"
                    :href="item.href || undefined"
                    class="block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                    <div
                        v-if="item.style === 'small'"
                        class="flex flex-col items-start gap-2 rounded-3xl p-2"
                    >
                        <UBadge
                            v-if="item.category"
                            :label="item.category"
                            icon="mingcute:hashtag-line"
                            variant="soft"
                        />

                        <div class="flex gap-3">
                            <NuxtImg
                                v-if="item.image"
                                :src="item.image"
                                :alt="item.title"
                                class="size-32 rounded-lg"
                            />

                            <div>
                                <h2 class="font-mono text-xl">{{ item.title }}</h2>
                                <p>{{ item.description }}</p>
                            </div>
                        </div>
                    </div>

                    <div
                        v-else-if="item.style === 'large'"
                        class="flex flex-col items-start gap-2 rounded-3xl p-2"
                    >
                        <UBadge
                            v-if="item.category"
                            :label="item.category"
                            icon="mingcute:hashtag-line"
                            variant="soft"
                        />

                        <NuxtImg
                            v-if="item.image"
                            :src="item.image"
                            :alt="item.title"
                            class="rounded-lg"
                        />

                        <h2 class="text-toned mx-1 font-mono text-sm">{{ item.title }}</h2>
                    </div>
                </component>
            </template>
        </MasonryWall>
    </UPage>
</template>
