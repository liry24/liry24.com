<script setup lang="ts">
const { sessions, busy, failure, current, refresh, revoke, revokeOthers, signOut } =
    useAdminSessions()
const devices = computed(() =>
    sessions.value.map((session) => ({ session, ...adminSessionDevice(session.userAgent) })),
)
</script>

<template>
    <UCard>
        <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="my-2 text-xl leading-none font-semibold">Sessions</h2>
                <UButton
                    icon="mingcute:refresh-2-line"
                    aria-label="Refresh sessions"
                    color="neutral"
                    variant="ghost"
                    :loading="busy"
                    @click="refresh"
                />
            </div>
        </template>
        <UAlert v-if="failure" :title="failure" color="error" class="mb-4" />
        <p class="text-muted mb-5 text-sm">
            Updated shows when the session was renewed, not your last activity.
        </p>
        <p v-if="busy && !sessions.length" class="text-muted text-sm">Loading sessions…</p>
        <p v-else-if="!sessions.length && !failure" class="text-muted text-sm">
            No active sessions.
        </p>
        <ul class="divide-muted divide-y">
            <li
                v-for="item in devices"
                :key="item.session.id"
                class="flex flex-wrap items-start gap-4 py-5 first:pt-0"
            >
                <UIcon :name="item.icon" class="text-muted mt-1 size-6 shrink-0" />
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <p class="font-medium">{{ item.browser }} on {{ item.os }}</p>
                        <UBadge
                            v-if="item.session.id === current?.id"
                            label="Current session"
                            color="success"
                            variant="subtle"
                        />
                    </div>
                    <p class="text-muted mt-1 text-xs">
                        {{ item.device }} · {{ item.session.ipAddress || 'Unknown IP' }}
                    </p>
                    <dl class="text-muted mt-3 grid gap-1 text-xs">
                        <div class="flex gap-2">
                            <dt>Created</dt>
                            <dd>
                                <NuxtTime
                                    :datetime="item.session.createdAt"
                                    date-style="medium"
                                    time-style="short"
                                />
                            </dd>
                        </div>
                        <div class="flex gap-2">
                            <dt>Updated</dt>
                            <dd>
                                <NuxtTime
                                    :datetime="item.session.updatedAt"
                                    date-style="medium"
                                    time-style="short"
                                />
                            </dd>
                        </div>
                        <div class="flex gap-2">
                            <dt>Expires</dt>
                            <dd>
                                <NuxtTime
                                    :datetime="item.session.expiresAt"
                                    date-style="medium"
                                    time-style="short"
                                />
                            </dd>
                        </div>
                    </dl>
                </div>
                <UButton
                    v-if="item.session.id === current?.id"
                    label="Logout"
                    variant="subtle"
                    color="neutral"
                    :disabled="busy"
                    @click="signOut()"
                />
                <UButton
                    v-else
                    label="Revoke"
                    variant="subtle"
                    color="error"
                    :disabled="busy"
                    @click="revoke(item.session.token)"
                />
            </li>
        </ul>
        <template #footer>
            <UButton
                label="Logout Other Sessions"
                variant="subtle"
                color="neutral"
                :disabled="busy || !sessions.some((item) => item.id !== current?.id)"
                @click="revokeOthers"
            />
        </template>
    </UCard>
</template>
