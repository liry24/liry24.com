import { expect, test } from 'vitest'

import { openTestDatabase } from './helpers/database'

test('native game constraints reject stale validation in either commit order', () => {
    const { sqlite: db, close } = openTestDatabase()
    try {
        const game = db.prepare(
            'INSERT INTO liti_games (id, version, created_at, updated_at, igdbId, slug, name, metrics) VALUES (?, 1, ?, ?, ?, ?, ?, ?)',
        )
        const now = '2026-10-28T00:00:00Z'
        game.run(
            'game',
            now,
            now,
            1,
            'game',
            'Game',
            JSON.stringify([{ key: 'score', label: 'Score', format: 'integer' }]),
        )
        expect(() => game.run('duplicate', now, now, 1, 'different', 'Other', '[]')).toThrow(
            /UNIQUE/,
        )
        expect(() => game.run('duplicate', now, now, 2, 'game', 'Other', '[]')).toThrow(/UNIQUE/)
        expect(() =>
            db.prepare('UPDATE liti_games SET slug = ? WHERE id = ?').run('changed', 'game'),
        ).toThrow(/immutable/)
        const stats = db.prepare(
            'INSERT INTO liti_gameStats (id, version, created_at, updated_at, game, periodKey, period, "values") VALUES (?, 1, ?, ?, ?, ?, ?, ?)',
        )
        // The request validated integer 500 before another request changed the metric to percent.
        db.prepare('UPDATE liti_games SET metrics = ? WHERE id = ?').run(
            JSON.stringify([{ key: 'score', label: 'Score', format: 'percent' }]),
            'game',
        )
        expect(() =>
            stats.run('stale', now, now, 'game', 'stale', 'Stale', '[{"key":"score","value":500}]'),
        ).toThrow(/game stats/)
        expect(db.prepare('SELECT COUNT(*) AS n FROM liti_gameStats').get()?.n).toBe(0)
        stats.run('stat', now, now, 'game', 'act-1', 'Act 1', '[{"key":"score","value":0}]')
        expect(() => stats.run('duplicate', now, now, 'game', 'act-1', 'Act 1', '[]')).toThrow(
            /UNIQUE/,
        )
        // A stats commit after the editor's precheck prevents a conflicting metric change.
        expect(() =>
            db.prepare('UPDATE liti_games SET metrics = ? WHERE id = ?').run('[]', 'game'),
        ).toThrow(/recorded metric/)
        expect(() =>
            db
                .prepare('UPDATE liti_games SET metrics = ? WHERE id = ?')
                .run('[{"key":"score","label":"Score","format":"integer"}]', 'game'),
        ).toThrow(/recorded metric/)
        expect(() =>
            db
                .prepare('UPDATE liti_gameStats SET "values" = ? WHERE id = ?')
                .run('[{"key":"score","value":101}]', 'stat'),
        ).toThrow(/game stats/)
        expect(
            JSON.parse(
                String(
                    db.prepare('SELECT "values" FROM liti_gameStats WHERE id = ?').get('stat')
                        ?.values,
                ),
            ),
        ).toEqual([{ key: 'score', value: 0 }])
        expect(() => db.prepare('DELETE FROM liti_games WHERE id = ?').run('game')).toThrow(
            /FOREIGN KEY/,
        )
        expect(() => stats.run('orphan', now, now, 'missing', 'act-1', 'Act 1', '[]')).toThrow()
    } finally {
        close()
    }
})
