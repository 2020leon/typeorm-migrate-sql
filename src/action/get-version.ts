import { getIndexOfStems, getStemOfFiles } from '../util/fs';
import { getDataSource, getVersionAndSuccessFromDb } from '../util/typeorm';
import SupportedDb from '../metadata/supported-db';
import logger from '../logger';

export default async function getVersion(
  database: string,
  options: {
    readonly type: SupportedDb;
    readonly host: string;
    readonly port: number;
    readonly user: string;
    readonly password: string;
    readonly dir: string;
    readonly migrationsTableName: string;
  },
): Promise<void> {
  try {
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
    } finally {
      await dataSource.destroy();
    }

    if (version < 0) {
      logger.warn('warn: no version found');
      logger.warn('warn: you may not have migrated the database via the tool');
      logger.warn('warn: or name of the migration table is wrong');
      return;
    }
    if (!success) {
      logger.warn('warn: the last migration is not success');
    }

    const [upUnionDown, upMinusDown, downMinusUp] = getStemOfFiles(options.dir);
    if (getIndexOfStems(upUnionDown, version) === -1) {
      logger.warn(
        `warn: invalid version number is stored in db. (no match file in ${options.dir})`,
      );
    }
    if (upMinusDown.length) {
      logger.warn('warn: missing down files:', upMinusDown.join(', '));
    }
    if (downMinusUp.length) {
      logger.warn('warn: missing up files:', downMinusUp.join(', '));
    }
    logger.info(String(version));
  } catch (err) {
    logger.error('error: getting version:', err);
    process.exit(1);
  }
}
