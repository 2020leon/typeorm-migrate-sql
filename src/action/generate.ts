import fs from 'fs';
import stream from 'stream';

import { getNewStemOfFile } from '../util/fs';
import { getDataSource } from '../util/typeorm';
import SupportedDb from '../metadata/supported-db';
import logger from '../logger';

/**
 *
 * @param sql
 * @param params
 * @see https://dev.to/avantar/how-to-output-raw-sql-with-filled-parameters-in-typeorm-14l4
 */
function parseQueryAndParams(
  sql: string,
  params?: readonly (string | object | number | boolean)[],
): string {
  let _sql = sql;
  if (params && params.length) {
    params.forEach((value) => {
      if (typeof value === 'string') {
        _sql = _sql.replace('?', `"${value}"`);
      } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
          _sql = _sql.replace(
            '?',
            value
              .map((element) =>
                typeof element === 'string' ? `"${element}"` : element,
              )
              .join(','),
          );
        } else {
          _sql = _sql.replace('?', String(value));
        }
      } else if (['number', 'boolean'].includes(typeof value)) {
        _sql = _sql.replace('?', value.toString());
      }
    });
  }
  return _sql;
}

function queriesToString(queries: readonly string[]): string {
  return queries.length ? `${queries.join(';\n')};\n` : '';
}

function writeFiles(
  migrationName: string,
  dir: string,
  upQueries: readonly string[],
  downQueries: readonly string[],
  dryRun: boolean,
  sequential: boolean,
): void {
  const fileStem = getNewStemOfFile(migrationName, dir, sequential);
  let upOut: stream.Writable = process.stdout;
  let downOut: stream.Writable = process.stdout;
  if (!dryRun) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    upOut = fs.createWriteStream(`${fileStem}.up.sql`);
    downOut = fs.createWriteStream(`${fileStem}.down.sql`);
  }
  logger.info(`-> ${fileStem}.up.sql`);
  if (dryRun) logger.info();
  upOut.write(queriesToString(upQueries));
  if (dryRun) logger.info();
  logger.info(`-> ${fileStem}.down.sql`);
  if (dryRun) logger.info();
  downOut.write(queriesToString(downQueries));
  if (!dryRun) {
    upOut.end();
    downOut.end();
  }
}

export default async function generate(
  database: string,
  migrationName: string,
  options: {
    readonly type: SupportedDb;
    readonly host: string;
    readonly port: number;
    readonly user: string;
    readonly password: string;
    readonly entities: string;
    readonly dir: string;
    readonly dryRun: boolean;
    readonly sequential: boolean;
  },
): Promise<void> {
  try {
    const dataSource = getDataSource(database, options);
    await dataSource.initialize();

    let upQueries: readonly string[] = [];
    let downQueries: readonly string[] = [];

    try {
      const sqlInMemory = await dataSource.driver.createSchemaBuilder().log();
      upQueries = sqlInMemory.upQueries.map((upQuery) =>
        parseQueryAndParams(upQuery.query, upQuery.parameters),
      );
      downQueries = sqlInMemory.downQueries.map((downQuery) =>
        parseQueryAndParams(downQuery.query, downQuery.parameters),
      );
    } finally {
      await dataSource.destroy();
    }

    if (!upQueries.length) {
      logger.info('no changes in database schema were found.');
    } else {
      writeFiles(
        migrationName,
        options.dir,
        upQueries,
        downQueries,
        options.dryRun,
        options.sequential,
      );
    }
  } catch (err) {
    logger.error('error: migration generation:', err);
    process.exit(1);
  }
}
