-- Run with the native migrations: checks must see the SQL commit, not an earlier JS read.
CREATE TRIGGER app_game_identity BEFORE UPDATE OF igdbId, slug, name ON liti_games
WHEN NEW.igdbId IS NOT OLD.igdbId OR NEW.slug IS NOT OLD.slug OR NEW.name IS NOT OLD.name
BEGIN
    SELECT RAISE(ABORT, 'CHECK constraint failed: immutable game identity');
END;
--> statement-breakpoint
CREATE TRIGGER app_recorded_metrics BEFORE UPDATE OF metrics ON liti_games
WHEN EXISTS (
    SELECT 1 FROM liti_gameStats AS stats, json_each(stats."values") AS value
    JOIN json_each(OLD.metrics) AS previous ON json_extract(previous.value, '$.key') = json_extract(value.value, '$.key')
    WHERE stats.game = OLD.id AND NOT EXISTS (
        SELECT 1 FROM json_each(NEW.metrics) AS current
        WHERE json_extract(current.value, '$.key') = json_extract(previous.value, '$.key')
          AND json_extract(current.value, '$.format') IS json_extract(previous.value, '$.format')
          AND COALESCE(json_extract(current.value, '$.unit'), '') = COALESCE(json_extract(previous.value, '$.unit'), '')
    )
)
BEGIN
    SELECT RAISE(ABORT, 'CHECK constraint failed: recorded metric definition');
END;
--> statement-breakpoint
CREATE TRIGGER app_stats_insert AFTER INSERT ON liti_gameStats
BEGIN
    SELECT RAISE(ABORT, 'CHECK constraint failed: game stats') WHERE
        NEW.game IS NULL OR NOT EXISTS (SELECT 1 FROM liti_games WHERE id = NEW.game)
        OR (NEW.start IS NOT NULL AND NEW.end IS NOT NULL AND julianday(NEW.start) > julianday(NEW.end))
        OR EXISTS (
            SELECT 1 FROM json_each(NEW."values") AS value
            LEFT JOIN liti_games AS game ON game.id = NEW.game
            LEFT JOIN json_each(game.metrics) AS metric ON json_extract(metric.value, '$.key') = json_extract(value.value, '$.key')
            WHERE metric.value IS NULL OR json_type(value.value, '$.value') IS NULL OR json_type(value.value, '$.value') NOT IN ('integer', 'real')
              OR json_extract(value.value, '$.value') < 0
              OR (json_extract(metric.value, '$.format') = 'percent' AND json_extract(value.value, '$.value') > 100)
              OR (json_extract(metric.value, '$.format') = 'integer' AND (
                  json_extract(value.value, '$.value') != CAST(json_extract(value.value, '$.value') AS INTEGER)
                  OR json_extract(value.value, '$.value') > 9007199254740991
              ))
        )
        OR (SELECT COUNT(*) FROM json_each(NEW."values")) != (SELECT COUNT(DISTINCT json_extract(value, '$.key')) FROM json_each(NEW."values"));
END;
--> statement-breakpoint
CREATE TRIGGER app_stats_update AFTER UPDATE OF game, "values", start, end ON liti_gameStats
BEGIN
    SELECT RAISE(ABORT, 'CHECK constraint failed: game stats') WHERE
        NEW.game IS NULL OR NOT EXISTS (SELECT 1 FROM liti_games WHERE id = NEW.game)
        OR (NEW.start IS NOT NULL AND NEW.end IS NOT NULL AND julianday(NEW.start) > julianday(NEW.end))
        OR EXISTS (
            SELECT 1 FROM json_each(NEW."values") AS value
            LEFT JOIN liti_games AS game ON game.id = NEW.game
            LEFT JOIN json_each(game.metrics) AS metric ON json_extract(metric.value, '$.key') = json_extract(value.value, '$.key')
            WHERE metric.value IS NULL OR json_type(value.value, '$.value') IS NULL OR json_type(value.value, '$.value') NOT IN ('integer', 'real')
              OR json_extract(value.value, '$.value') < 0
              OR (json_extract(metric.value, '$.format') = 'percent' AND json_extract(value.value, '$.value') > 100)
              OR (json_extract(metric.value, '$.format') = 'integer' AND (
                  json_extract(value.value, '$.value') != CAST(json_extract(value.value, '$.value') AS INTEGER)
                  OR json_extract(value.value, '$.value') > 9007199254740991
              ))
        )
        OR (SELECT COUNT(*) FROM json_each(NEW."values")) != (SELECT COUNT(DISTINCT json_extract(value, '$.key')) FROM json_each(NEW."values"));
END;
