import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { DataSource, Table } from 'typeorm';

import { getIndexOfStems, getPrefixDigits, getStemOfFiles } from '../util/fs';
import {
  getDataSource,
  getVersionAndSuccessFromDb,
  tableNameToTable,
} from '../util/typeorm';
import TypeormMigrateSqlError from '../error/typeorm-migrate-sql-error';
import SupportedDb from '../metadata/supported-db';
import logger from '../logger';

async function createMigrationsTableIfNotExist(
  dataSource: DataSource,
  type: SupportedDb,
  migrationsTableName: string,
): Promise<void> {
  // If driver is mongo no need to create
  if ((type as string) === 'mongodb') return;
  const queryRunner = dataSource.createQueryRunner();
  const tableExist = await queryRunner.hasTable(migrationsTableName);
  // the table has 4 columns
  // id (auto increment)
  // timestamp (bigint)
  // version (bigint)
  // success (boolean)
  if (!tableExist) {
    await queryRunner.createTable(
      new Table({
        name: migrationsTableName,
        columns: [
          {
            name: 'id',
            type: dataSource.driver.normalizeType({
              type: dataSource.driver.mappedDataTypes.migrationId,
            }),
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'timestamp',
            type: dataSource.driver.normalizeType({
              type: dataSource.driver.mappedDataTypes.migrationTimestamp,
            }),
            isPrimary: false,
            isNullable: false,
          },
          {
            name: 'version',
            type: dataSource.driver.normalizeType({
              type: dataSource.driver.mappedDataTypes.migrationTimestamp,
            }),
            isPrimary: false,
            isNullable: true,
          },
          {
            name: 'success',
            type: dataSource.driver.normalizeType({ type: Boolean }),
            isPrimary: false,
            isNullable: false,
          },
        ],
      }),
    );
  }
}

/**
 *
 * @param dataSource
 * @param type
 * @param migrationsTableName
 * @param targetVersion
 * @param success
 * @see https://github.com/typeorm/typeorm/blob/0.3.7/src/migration/MigrationExecutor.ts#L560
 */
async function recordExecutedMigration(
  dataSource: DataSource,
  type: SupportedDb,
  migrationsTableName: string,
  targetVersion: string,
  success: boolean,
): Promise<void> {
  // the table has 4 columns
  // id (auto increment)
  // timestamp (bigint)
  // version (bigint)
  // success (boolean)
  const queryRunner = dataSource.createQueryRunner();
  const migrationsTable = tableNameToTable(dataSource, migrationsTableName);
  const values = {
    timestamp: String(new Date().getTime()),
    version: targetVersion || null,
    success,
  };
  if ((type as string) === 'mssql') {
    throw new Error('TODO: not implemented');
  }
  if ((type as string) === 'mongodb') {
    throw new Error('TODO: not implemented');
  } else {
    await queryRunner.manager
      .createQueryBuilder()
      .insert()
      .into(migrationsTable)
      .values(values)
      .execute();
  }
}

async function execSqlFiles(
  dataSource: DataSource,
  type: SupportedDb,
  migrationsTableName: string,
  filenamesAndTargetVersionsPair: readonly (readonly [string, string])[],
): Promise<undefined[]> {
  return filenamesAndTargetVersionsPair.reduce(
    async (promiseResults, [filename, targetVersion]) => {
      const results = await promiseResults;
      // run migrations
      // TODO: execute each statement
      try {
        const result = await dataSource.query(
          fs.readFileSync(filename).toString(),
        );
        results.push(result);
      } catch (err) {
        logger.error(`error: failed while executing ${filename}`);
        await recordExecutedMigration(
          dataSource,
          type,
          migrationsTableName,
          targetVersion,
          false,
        );
        throw err;
      }
      // update migrations table
      await recordExecutedMigration(
        dataSource,
        type,
        migrationsTableName,
        targetVersion,
        true,
      );
      logger.info('->', filename);
      return results;
    },
    Promise.resolve([] as undefined[]),
  );
}

export default async function run(
  database: string,
  action: bigint | number,
  options: {
    readonly type: SupportedDb;
    readonly host: string;
    readonly port: number;
    readonly user: string;
    readonly yes: boolean;
    readonly password: string;
    readonly dir: string;
    readonly dryRun: boolean;
    readonly migrationsTableName: string;
  },
): Promise<void> {
  try {
    if (action === 0) {
      logger.info('versions matched');
      return;
    }
    if (typeof action === 'bigint' && action < 0) {
      throw new TypeormMigrateSqlError('invalid goto version number');
    }

    const dataSource = getDataSource(database, options);
    await dataSource.initialize();

    let version = BigInt(-1);
    let success = false;

    try {
      [version, success] = await getVersionAndSuccessFromDb(
        dataSource,
        options.type,
        options.migrationsTableName,
      );
      if (version >= 0 && !success) {
        throw new TypeormMigrateSqlError(
          'the last migration is not success, please cleanup db and run again',
        );
      }

      const [upUnionDown, upMinusDown, downMinusUp] = getStemOfFiles(
        options.dir,
      );
      let currentVersionIndex = -1;
      if (version < 0) {
        if (!options.dryRun) {
          await createMigrationsTableIfNotExist(
            dataSource,
            options.type,
            options.migrationsTableName,
          );
        }
      } else {
        currentVersionIndex = getIndexOfStems(upUnionDown, version);
        if (currentVersionIndex === -1) {
          throw new TypeormMigrateSqlError(
            'invalid version number is stored in db',
          );
        }
      }

      let expectedVersionIndex = currentVersionIndex;
      if (typeof action === 'bigint') {
        // "goto" command
        expectedVersionIndex = getIndexOfStems(upUnionDown, action);
        if (expectedVersionIndex === -1) {
          throw new TypeormMigrateSqlError('invalid goto version number');
        }
      } else {
        // "up" command, "down" command
        expectedVersionIndex += action;
        if (expectedVersionIndex < 0) expectedVersionIndex = -1;
        else if (expectedVersionIndex >= upUnionDown.length) {
          throw new TypeormMigrateSqlError('invalid up/down count');
        }
      }

      if (expectedVersionIndex === currentVersionIndex) {
        logger.info('versions matched');
        return;
      }

      const stemOfFiles =
        expectedVersionIndex > currentVersionIndex
          ? // up
            upUnionDown.slice(currentVersionIndex + 1, expectedVersionIndex + 1)
          : // down
            upUnionDown
              .slice(expectedVersionIndex + 1, currentVersionIndex + 1)
              .reverse();

      const missingUp = stemOfFiles.filter((stem) =>
        downMinusUp.includes(stem),
      );
      if (missingUp.length) {
        throw new TypeormMigrateSqlError(
          `missing up files: ${missingUp.join(', ')}`,
        );
      }
      const missingDown = stemOfFiles.filter((stem) =>
        upMinusDown.includes(stem),
      );
      if (missingDown.length) {
        throw new TypeormMigrateSqlError(
          `missing down files: ${missingDown.join(', ')}`,
        );
      }

      logger.info(
        `-> migrate from ${
          currentVersionIndex >= 0 ? upUnionDown[currentVersionIndex] : '(nil)'
        } to ${
          expectedVersionIndex >= 0
            ? upUnionDown[expectedVersionIndex]
            : '(nil)'
        }`,
      );
      if (!options.yes) {
        const ans = await new Promise<string>((resolve) => {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          rl.on('SIGINT', () => {
            process.stdout.write('\n');
            rl.close();
            // TODO: exit gracefully
            process.exit(130);
          }).question('-> run migrations (y)? ', (answer) => {
            resolve(answer);
            rl.close();
          });
        });
        if (ans !== 'y') return;
      }

      if (options.dryRun) {
        const filenames = stemOfFiles.map(
          expectedVersionIndex > currentVersionIndex
            ? (stem) => path.resolve(options.dir, `${stem}.up.sql`)
            : (stem) => path.resolve(options.dir, `${stem}.down.sql`),
        );
        logger.info();
        filenames.forEach((filename) => logger.info('->', filename));
      } else {
        const filenamesAndTargetVersionsPair: readonly (readonly [
          string,
          string,
        ])[] = stemOfFiles.map(
          expectedVersionIndex > currentVersionIndex
            ? (stem) => [
                path.resolve(options.dir, `${stem}.up.sql`),
                getPrefixDigits(stem),
              ]
            : (stem, i) => [
                path.resolve(options.dir, `${stem}.down.sql`),
                i + 1 < stemOfFiles.length
                  ? getPrefixDigits(stemOfFiles[i + 1])
                  : '',
              ],
        );
        logger.info();
        await execSqlFiles(
          dataSource,
          options.type,
          options.migrationsTableName,
          filenamesAndTargetVersionsPair,
        );
      }
    } finally {
      await dataSource.destroy();
    }
  } catch (err) {
    logger.error('error: migration:', err);
    process.exit(1);
  }
}
