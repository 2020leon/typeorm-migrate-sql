import { DataSource } from 'typeorm';

import SupportedDb from '../metadata/supported-db';

export function getDataSource(
  database: string,
  options: {
    readonly type: SupportedDb;
    readonly host: string;
    readonly port: number;
    readonly user: string;
    readonly password: string;
    readonly entities?: string;
  },
): DataSource {
  const defaultOptions = {
    database,
    synchronize: false,
    migrationsRun: false,
    dropSchema: false,
    logging: false,
    entities: options.entities ? [options.entities] : undefined,
  };
  switch (options.type) {
    case 'mysql':
    case 'mariadb':
      return new DataSource({
        ...defaultOptions,
        type: options.type,
        host: options.host,
        port: options.port,
        username: options.user,
        password: options.password,
        // TODO: Be careful with this, it could increase the scope of SQL
        // injection attacks.
        multipleStatements: true,
      });
    default:
      throw new Error('TODO: not implemented');
  }
}

export function tableNameToTable(
  dataSource: DataSource,
  tableName: string,
): string {
  const { schema } = dataSource.driver.options as unknown as {
    schema?: string;
  };
  const { database } = dataSource.driver;
  return dataSource.driver.buildTableName(tableName, schema, database);
}

export async function getVersionAndSuccessFromDb(
  dataSource: DataSource,
  type: SupportedDb,
  migrationsTableName: string,
): Promise<[bigint, boolean]> {
  const queryRunner = dataSource.createQueryRunner();
  if ((type as string) === 'mongodb') {
    throw new Error('TODO: not implemented');
  } else {
    const migrationsTable = tableNameToTable(dataSource, migrationsTableName);
    const tableExist = await queryRunner.hasTable(migrationsTableName);
    if (!tableExist) return [BigInt(-1), false];
    const result = await dataSource.manager
      .createQueryBuilder(queryRunner)
      .select('version')
      .addSelect('success')
      .from(migrationsTable, migrationsTableName)
      .where(
        (queryBuilder) =>
          `id = ${queryBuilder
            .subQuery()
            .select('MAX(id)', 'id')
            .from(migrationsTable, migrationsTableName)
            .getQuery()}`,
      )
      .getRawOne();

    return result
      ? [
          BigInt(result.version !== null ? result.version : -1),
          !!result.success,
        ]
      : [BigInt(-1), true];
  }
}
