#!/usr/bin/env node

/**
 * @see https://github.com/typeorm/typeorm/blob/0.3.7/src/commands/MigrationGenerateCommand.ts
 * @see https://github.com/typeorm/typeorm/blob/0.3.7/src/migration/MigrationExecutor.ts#L409
 */

import { program } from 'commander';

import {
  name,
  version as packageVersion,
  description,
} from './metadata/package';
import {
  askPasswordIfNeeded,
  registerCommand,
  printConnectOptions,
} from './util/cli';

if (require.main === module) {
  program.name(name);
  program.description(description);
  program.version(packageVersion, '--version', 'Output the version number.');
  program.showHelpAfterError('(Add --help for additional information)');
  program.helpOption('--help', 'Print this page.');
  program.addHelpCommand(true, 'Print help page.');

  registerCommand(
    program,
    'create',
    'Create a set of up/down migrations.',
    ['migration'],
    { dryRun: true, path: true, sequential: true },
    async (migrationName, options) =>
      (await import('./action/create')).default(migrationName, {
        dir: options.path,
        dryRun: Boolean(options.dryRun),
        sequential: Boolean(options.sequential),
      }),
  );

  registerCommand(
    program,
    'generate',
    'Generate a set of up/down migrations.',
    ['database', 'migration'],
    {
      host: true,
      port: true,
      password: true,
      type: true,
      user: true,
      dryRun: true,
      entities: true,
      javascript: true,
      path: true,
      sequential: true,
    },
    async (database, migrationName, options) => {
      const promiseTsNode = options.javascript
        ? Promise.resolve()
        : import('ts-node').then((module) => {
            module.register({ transpileOnly: true });
          });
      printConnectOptions(database, options);
      const password = await askPasswordIfNeeded(options);
      await promiseTsNode;
      return (await import('./action/generate')).default(
        database,
        migrationName,
        {
          type: options.type,
          host: options.host,
          port: options.port,
          user: options.user,
          password,
          entities: options.entities,
          dir: options.path,
          dryRun: Boolean(options.dryRun),
          sequential: Boolean(options.sequential),
        },
      );
    },
  );

  registerCommand(
    program,
    'up',
    'Apply one or multiple up migrations.',
    ['database', 'count'],
    {
      host: true,
      port: true,
      password: true,
      type: true,
      user: true,
      yes: true,
      dryRun: true,
      path: true,
      tableName: true,
    },
    async (database, count, options) => {
      printConnectOptions(database, options);
      return (await import('./action/run')).default(database, +count, {
        type: options.type,
        host: options.host,
        port: options.port,
        user: options.user,
        yes: options.yes,
        password: await askPasswordIfNeeded(options),
        dir: options.path,
        dryRun: Boolean(options.dryRun),
        migrationsTableName: options.tableName,
      });
    },
  );

  registerCommand(
    program,
    'down',
    'Apply one or multiple down migrations.',
    ['database', 'count'],
    {
      host: true,
      port: true,
      password: true,
      type: true,
      user: true,
      yes: true,
      dryRun: true,
      path: true,
      tableName: true,
    },
    async (database, count, options) => {
      printConnectOptions(database, options);
      return (await import('./action/run')).default(database, -count, {
        type: options.type,
        host: options.host,
        port: options.port,
        user: options.user,
        yes: options.yes,
        password: await askPasswordIfNeeded(options),
        dir: options.path,
        dryRun: Boolean(options.dryRun),
        migrationsTableName: options.tableName,
      });
    },
  );

  registerCommand(
    program,
    'goto',
    'Migrate to specific version.',
    ['database', 'version'],
    {
      host: true,
      port: true,
      password: true,
      type: true,
      user: true,
      yes: true,
      dryRun: true,
      path: true,
      tableName: true,
    },
    async (database, version, options) => {
      printConnectOptions(database, options);
      return (await import('./action/run')).default(database, version, {
        type: options.type,
        host: options.host,
        port: options.port,
        user: options.user,
        yes: options.yes,
        password: await askPasswordIfNeeded(options),
        dir: options.path,
        dryRun: Boolean(options.dryRun),
        migrationsTableName: options.tableName,
      });
    },
  );

  registerCommand(
    program,
    'version',
    'Get current migration version.',
    ['database'],
    {
      host: true,
      port: true,
      password: true,
      type: true,
      user: true,
      path: true,
      tableName: true,
    },
    async (database, options) => {
      printConnectOptions(database, options);
      return (await import('./action/get-version')).default(database, {
        type: options.type,
        host: options.host,
        port: options.port,
        user: options.user,
        password: await askPasswordIfNeeded(options),
        dir: options.path,
        migrationsTableName: options.tableName,
      });
    },
  );

  program.parse();
}
