import fs from 'fs';

import { getNewStemOfFile } from '../util/fs';
import logger from '../logger';

export default function create(
  migrationName: string,
  options: {
    readonly dir: string;
    readonly dryRun: boolean;
    readonly sequential: boolean;
  },
): void {
  try {
    const fileStem = getNewStemOfFile(
      migrationName,
      options.dir,
      options.sequential,
    );
    if (!options.dryRun) {
      if (!fs.existsSync(options.dir)) {
        fs.mkdirSync(options.dir, { recursive: true });
      }
      fs.closeSync(fs.openSync(`${fileStem}.up.sql`, 'w'));
    }
    logger.info(`-> ${fileStem}.up.sql`);
    if (!options.dryRun) fs.closeSync(fs.openSync(`${fileStem}.down.sql`, 'w'));
    logger.info(`-> ${fileStem}.down.sql`);
  } catch (err) {
    logger.error('error: migration creation:', err);
    process.exit(1);
  }
}
