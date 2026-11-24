import { describe, expect, it } from 'vitest'

import { wcagViolations } from './helpers/accessibility'

describe('accessibility gate', () => {
    it('rejects every WCAG 2.2 A/AA violation, including lower-impact findings', () => {
        const violations = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'].map(
            (tag, index) => ({
                id: `violation-${index}`,
                tags: ['cat.forms', tag],
                impact: ['minor', 'moderate', 'serious', 'critical', null][index],
            }),
        )
        expect(wcagViolations(violations)).toEqual(violations)
    })

    it('keeps best practices, AAA and obsolete rules outside the mandatory gate', () => {
        const violations = ['best-practice', 'wcag2aaa', 'wcag2a-obsolete'].map((tag) => ({
            tags: [tag],
            impact: 'critical',
        }))
        expect(wcagViolations(violations)).toEqual([])
    })
})
