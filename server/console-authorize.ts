import { defineConsoleAuthorize } from 'vite-hub/console/auth'
export default defineConsoleAuthorize(({ user }) =>
    user?.role === 'admin' ? { sections: ['content'] } : false,
)
