import fs from 'fs';
import path from 'path';

import TypeormMigrateSqlError from '../error/typeorm-migrate-sql-error';
import logger from '../logger';

export function getStemOfFiles(dir: string): [string[], string[], string[]] {
  if (!fs.existsSync(dir)) return [[], [], []];
  const filenames = fs.readdirSync(dir);
  const upStems = filenames
    .map((filename) => {
      const result = /^(\d+_.*)\.up\.sql$/.exec(filename);
      return result ? result[1] : '';
    })
    .filter((stem) => stem);
  const downStems = filenames
    .map((filename) => {
      const result = /^(\d+_.*)\.down\.sql$/.exec(filename);
      return result ? result[1] : '';
    })
    .filter((stem) => stem);
  const upSet = new Set(upStems);
  const downSet = new Set(downStems);
  const upMinusDown = upStems.filter((filename) => !downSet.has(filename));
  const downMinusUp = downStems.filter((filename) => !upSet.has(filename));
  const upUnionDown = [...new Set([...upStems, ...downStems])];
  return [upUnionDown.sort(), upMinusDown, downMinusUp];
}

/**
 * Get prefix digits.
 * @param str any string
 * @returns prefix digit, or empty string if fail
 */
export function getPrefixDigits(str: string): string {
  const result = /^(\d+)/.exec(str);
  return result ? result[1] : '';
}

export function getNewStemOfFile(
  migrationName: string,
  dir: string,
  sequential: boolean,
): string {
  // check migrationName is valid
  if (/[/\\:*"?<>|]/g.test(migrationName)) {
    throw new TypeormMigrateSqlError(`invalid filename: ${migrationName}`);
  }
  // check missing files
  const [upUnionDown, upMinusDown, downMinusUp] = getStemOfFiles(dir);
  if (upMinusDown.length) {
    logger.warn('warn: missing down files:', upMinusDown.join(', '));
  }
  if (downMinusUp.length) {
    logger.warn('warn: missing up files:', downMinusUp.join(', '));
  }
  // determine numStr
  let numStr = String(new Date().getTime());
  const strLen = numStr.length;
  const lastStem = upUnionDown.pop();
  if (lastStem) {
    const _numStr = getPrefixDigits(lastStem); // never fail
    const _strLen = _numStr.length;
    if (sequential) {
      const currentNum = BigInt(_numStr);
      if (currentNum >= BigInt('9'.repeat(_strLen))) {
        throw new TypeormMigrateSqlError('too big');
      }
      numStr = String(currentNum + BigInt(1)).padStart(_strLen, '0');
    } else if (strLen !== _strLen) {
      logger.warn('warn: length not equal in timestamps mode.');
    }
  } else if (sequential) numStr = '0'.repeat(strLen);
  return path.resolve(dir, `${numStr}_${migrationName}`);
}

export function getIndexOfStems(
  stemOfFiles: readonly string[],
  version: bigint,
): number {
  return stemOfFiles
    .map((stem) => BigInt(getPrefixDigits(stem) || -1))
    .indexOf(version);
}
