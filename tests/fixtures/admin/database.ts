import { DatabaseSync } from 'node:sqlite'

import { drizzle } from 'drizzle-orm/d1'

import migrations from '#fixture/migrations'

import { sqliteD1 } from '../../helpers/d1'
export * from 'drizzle-orm'
export const sqlite = new DatabaseSync(':memory:')
sqlite.exec('PRAGMA foreign_keys=ON')
for (const migration of migrations) sqlite.exec(migration)
export const db = drizzle(sqliteD1(sqlite))
