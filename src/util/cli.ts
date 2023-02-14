import stream from 'stream';
import readline from 'readline';
import commander from 'commander';

import SupportedDb from '../metadata/supported-db';
import logger from '../logger';

type ArgKeys = 'database' | 'migration' | 'count' | 'version';

type OptionKeys =
  | 'host'
  | 'port'
  | 'password'
  | 'type'
  | 'user'
  | 'yes'
  | 'dryRun'
  | 'entities'
  | 'javascript'
  | 'path'
  | 'sequential'
  | 'tableName';

const supportedDb: readonly SupportedDb[] = ['mysql', 'mariadb'];

export async function askPasswordIfNeeded(options: {
  readonly type: string;
  readonly password?: string;
}): Promise<string> {
  if (options.type === 'sqlite' || options.password)
    return options.password ?? '';
  return new Promise<string>((resolve) => {
    let muted = false;
    const rl = readline.createInterface({
      input: process.stdin,
      output: new stream.Writable({
        write: (chunk, encoding, callback) => {
          if (!muted) process.stdout.write(chunk, encoding);
          callback();
        },
      }),
      terminal: true,
    });
    rl.on('SIGINT', () => {
      rl.close();
      process.stdout.write('\n');
      // TODO: exit gracefully
      process.exit(130);
    }).question('password: ', (answer) => {
      resolve(answer);
      rl.close();
      process.stdout.write('\n');
    });
    muted = true;
  });
}

export function registerCommand(
  program: commander.Command,
  commandName: string,
  description: string,
  args: readonly ArgKeys[],
  options: { readonly [K in OptionKeys]?: true },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (..._: readonly any[]) => void | Promise<void>,
): commander.Command {
  const _args: { readonly [K in ArgKeys]: () => commander.Argument } = {
    database: () =>
      new commander.Argument(
        '<database>',
        'Name of a database/schema.', // (or path for sqlite)
      ),
    migration: () =>
      new commander.Argument(
        '<migration>',
        'Title of the set of up/down migrations.',
      ),
    count: () =>
      new commander.Argument('[count]', 'Migration count.')
        .default(1)
        .argParser((value) => parseInt(value, 10)),
    version: () =>
      new commander.Argument(
        '<version>',
        'Version exists in <path>.',
      ).argParser((value) => BigInt(value)),
  };
  const _options: { readonly [K in OptionKeys]: () => commander.Option } = {
    host: () =>
      new commander.Option('-h, --host <name>', 'Connect to host.').default(
        'localhost',
      ),
    port: () =>
      new commander.Option(
        '-P, --port <#>',
        'Port number to use for connection.',
      )
        .default(3306)
        .argParser((value) => parseInt(value, 10)),
    password: () =>
      new commander.Option(
        '-p, --password <pwd>',
        "Password to use when connecting to server. If password is not given it's asked from the tty.",
      ),
    type: () =>
      new commander.Option('-t, --type <type>', 'Type of the database.')
        .choices(supportedDb)
        .default('mysql'),
    user: () =>
      new commander.Option(
        '-u, --user <name>',
        'User for login if not current user.',
      ).env('USER'),
    yes: () => new commander.Option('-y, --yes', 'Automatic yes to prompts.'),
    dryRun: () =>
      new commander.Option('--dry-run', 'Do not create any table or file.'),
    entities: () =>
      new commander.Option(
        '--entities <path>',
        'Location of entities. Quotes may required.',
      ).default('src/entity/*.ts'),
    javascript: () =>
      new commander.Option('--js, --javascript', 'Do not load ts-node.'),
    path: () =>
      new commander.Option(
        '--path <path>',
        'Location of the migrations.',
      ).default('db/migrations'),
    sequential: () =>
      new commander.Option(
        '--sequential',
        'Use sequential numbers as filenames instead of timestamps.',
      ),
    tableName: () =>
      new commander.Option(
        '--table-name <name>',
        'Name of the migration table to store versions of migrations.',
      ).default('migrations'),
  };

  const command = program.command(commandName).description(description);
  args.forEach((key) => command.addArgument(_args[key]()));
  Object.keys(options).forEach((key) =>
    command.addOption(_options[key as OptionKeys]()),
  );
  command.action(action);
  return program;
}

export function printConnectOptions(
  database: string,
  options: {
    readonly type: string;
    readonly host: string;
    readonly port: string;
    readonly user: string;
  },
): void {
  logger.info('-> type:', options.type);
  if (options.type !== 'sqlite') {
    logger.info('-> host:', options.host);
    logger.info('-> port:', options.port);
    logger.info('-> user:', options.user);
  }
  logger.info('-> database:', database);
  logger.info();
}
