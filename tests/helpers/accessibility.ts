import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import axe from 'axe-core'
import type { Page } from 'playwright-core'

declare global {
    interface Window {
        axe: typeof axe
    }
}

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const wcagRules = Object.fromEntries(
    axe
        .getRules(wcagTags)
        .filter(({ tags }) => !tags.includes('experimental') && !tags.includes('deprecated'))
        .map(({ ruleId }) => [ruleId, { enabled: true }]),
)

export function wcagViolations<T extends { tags: string[] }>(violations: T[]): T[] {
    return violations.filter((violation) => violation.tags.some((tag) => wcagTags.includes(tag)))
}

export async function runAccessibilityChecks(page: Page) {
    await page.addScriptTag({ content: axe.source })
    // Include stable A/AA rules such as target-size that axe leaves disabled by default.
    return page.evaluate((rules) => window.axe.run(document, { rules }), wcagRules)
}

export async function scanAccessibility(page: Page, state: string) {
    const directory = resolve('.tmp/accessibility')
    await mkdir(directory, { recursive: true })
    const filename = resolve(directory, state.replace(/[^a-z0-9-]+/gi, '-'))
    const context = {
        state,
        url: page.url(),
        viewport: page.viewportSize(),
        colorScheme: await page.evaluate(() =>
            document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        ),
    }
    let results: axe.AxeResults
    try {
        await page.waitForFunction(() => {
            const nuxt = (document.querySelector('#__nuxt') as any)?.__vue_app__?.config
                .globalProperties.$nuxt
            return nuxt?.isHydrating === false && !nuxt['~transitionPromise']
        })
        await page.evaluate(async () => {
            await document.fonts.ready
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            await Promise.all(
                document
                    .getAnimations()
                    .filter(
                        (animation) =>
                            animation.playState === 'running' &&
                            Number.isFinite(animation.effect?.getComputedTiming().endTime),
                    )
                    .map((animation) => animation.finished.catch(() => undefined)),
            )
        })
        const applicationError = await page.evaluate(
            () =>
                (document.querySelector('#__nuxt') as any)?.__vue_app__?.config.globalProperties
                    .$nuxt?.payload.error,
        )
        if (applicationError)
            throw new Error(
                `Application failed before accessibility scan: ${JSON.stringify(applicationError)}`,
            )
        results = await runAccessibilityChecks(page)
    } catch (error) {
        await writeFile(
            `${filename}.json`,
            JSON.stringify({ ...context, error: String(error) }, null, 2),
        )
        await page.screenshot({ path: `${filename}.png`, fullPage: true })
        throw error
    }
    const blocking = wcagViolations(results.violations)
    await writeFile(
        `${filename}.json`,
        JSON.stringify(
            {
                ...context,
                engine: results.testEngine,
                violations: blocking,
                otherViolations: results.violations.filter(
                    (violation) => !blocking.includes(violation),
                ),
                incomplete: results.incomplete,
            },
            null,
            2,
        ),
    )
    if (
        blocking.length ||
        ['light-1280-home', 'light-390-arts-viewer', 'light-1280-admin-settings'].includes(state)
    )
        await page.screenshot({ path: `${filename}.png`, fullPage: true })
    return blocking.map(({ id, impact, nodes }) => ({
        ...context,
        id,
        impact,
        targets: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    }))
}
