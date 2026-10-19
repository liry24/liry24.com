// Authentication and SDK calls are replaced with mockNuxtImport in runtime tests.
export function useUserSession(): any {
    throw new Error('Mock the session boundary')
}
export function useI18n(): any {
    throw new Error('Mock the locale boundary')
}
export function useAdminClient(): any {
    throw new Error('Mock the SDK boundary')
}
export function useAi(..._args: any[]): any {
    throw new Error('Mock the AI boundary')
}
