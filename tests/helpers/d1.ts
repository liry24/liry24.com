import type { DatabaseSync, SQLInputValue } from 'node:sqlite'

type DatabaseValue = SQLInputValue | boolean

/** SQLite-backed D1 fixture. The production path only uses native D1 bindings. */
export const sqliteD1 = (database: DatabaseSync) => {
    const affected = database.prepare('SELECT changes() AS changes')
    const statementMap = new WeakMap<object, Statement>()

    class Statement {
        constructor(
            readonly sql: string,
            readonly params: Array<SQLInputValue> = [],
        ) {
            statementMap.set(this, this)
        }
        bind(...params: Array<DatabaseValue>) {
            return new Statement(
                this.sql,
                params.map((value) => (typeof value === 'boolean' ? Number(value) : value)),
            )
        }
        execute() {
            const prepared = database.prepare(this.sql)
            const results = prepared.all(...this.params)
            const row = affected.get()
            const changes = row && typeof row.changes === 'number' ? row.changes : 0
            return { success: true, results, meta: { changes } }
        }
        async all() {
            return this.execute()
        }
        async run() {
            return this.execute()
        }
        async raw() {
            const prepared = database.prepare(this.sql)
            prepared.setReturnArrays(true)
            return prepared.all(...this.params)
        }
    }

    const binding = {
        prepare: (sql: string) => new Statement(sql),
        async batch(input: Array<unknown>) {
            const statements = input.map((statement) => {
                if (typeof statement !== 'object' || statement === null) {
                    throw new Error('Statement belongs to another D1 binding.')
                }
                const mapped = statementMap.get(statement)
                if (!mapped) {
                    throw new Error('Statement belongs to another D1 binding.')
                }
                return mapped
            })
            database.exec(
                statements.every(({ sql }) => /^\s*(SELECT|PRAGMA)\b/iu.test(sql))
                    ? 'BEGIN'
                    : 'BEGIN IMMEDIATE',
            )
            try {
                const results = statements.map((statement) => statement.execute())
                database.exec('COMMIT')
                return results
            } catch (error) {
                database.exec('ROLLBACK')
                throw error
            }
        },
        withSession: () => binding,
    }
    return binding
}
