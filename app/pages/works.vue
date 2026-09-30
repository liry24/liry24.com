<script setup lang="ts">
import { MasonryWall } from '@yeger/vue-masonry-wall'

const client = useSiteAdminClient()
const { data } = await useAsyncData('public:works', async () =>
    (await client.list<ContentEntry<'works'>>('works')).map((entry) => ({
        ...entry.data,
        slug: entry.slug,
        image: contentAssetSrc(entry.data.image, client),
    })),
)

defineSeo({
    title: 'Works',
    titleTemplate: '%s | Liry24',
    description: 'A collection of works by Liry24.',
    image: {
        component: 'Home.takumi',
        props: { title: 'Liry24', subpath: 'works' },
        options: [{ key: 'og' }, { key: 'whatsapp', width: 800, height: 800 }],
    },
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

                    <template #content> </template>
                </UModal>
            </template>
        </MasonryWall>
    </UPage>
</template>
