# Typeorm Migrate Sql

Typeorm Migrate Sql - Generate Sql Files and Migrate

Typeorm Migrate Sql is a package that can generate new migrations in sql format
and runs those generated migrations.

## Supported Databases

- MySQL
- MariaDB

## Requirements

| Engine/Package         | Version          | Optional |
|------------------------|------------------|----------|
| Node.js                | ^12.20.0 or >=14 |          |
| [TypeORM][typeorm]     | ^0.3.0           |          |
| [Node MySQL 2][mysql2] | ^2.2.5           |          |
| [ts-node][ts-node]     | ^10.7.0          | true     |

## Installation

You can install Typeorm Migrate Sql using `npm`, `yarn`, or `pnpm`.

```sh
# npm
npm i typeorm-migrate-sql
# yarn
yarn add typeorm-migrate-sql
# pnpm
pnpm add typeorm-migrate-sql
```

## Usage

### CLI

Running our command via `npx`.

```sh
npx typeorm-migrate-sql help
```

We recommend that you add the following to `package.json` for convenience.

```json
{
  "scripts": {
    "migrate": "typeorm-migrate-sql"
  }
}
```

Then you may run the command like following.

```sh
npm run migrate -- help
```

#### Create a Set of Up/Down Migrations

```sh
npx typeorm-migrate-sql create add_user
```

The command creates two empty files called `<timestamp>_add_user.up.sql` and
`<timestamp>_add_user.down.sql` in directory `db/migrations`. You can specify
the directory via cli options.

#### Generate a Set of Up/Down Migrations

```sh
npx typeorm-migrate-sql generate my_schema add_user
```

After modifying typeorm entities, you can run this command to generate two sql
files called `<timestamp>_add_user.up.sql` and `<timestamp>_add_user.down.sql`
in directory `db/migrations`. You can set connection options, location of
entities, and the output directory via cli options.

#### Get Current Migration Version

```sh
npx typeorm-migrate-sql version my_schema
```

The command gets current migration version recorded in the database. Connection
and some other options can be set via cli options.

#### Run Migrations

```sh
# run either one
npx typeorm-migrate-sql up my_schema
npx typeorm-migrate-sql down my_schema
npx typeorm-migrate-sql goto my_schema 1637690400000
```

These commands run migrations to a version. `up` applies an up migration, `down`
applies a down migration, while `goto` migrates to the specific version.
Similarly, options can be set via cli. Note that if the last migration failed,
these commands will also fail.

## Inspiration

The package is inspired by [golang-migrate][golang-migrate].

## Contributing

Contributing is welcome!

## License

MIT

## Links

[GitHub](https://github.com/2020leon/typeorm-migrate-sql),
[npm](https://www.npmjs.com/package/typeorm-migrate-sql),
[yarn](https://yarnpkg.com/package/typeorm-migrate-sql)

[typeorm]: https://github.com/typeorm/typeorm
[mysql2]: https://github.com/sidorares/node-mysql2
[ts-node]: https://github.com/TypeStrong/ts-node
[golang-migrate]: https://github.com/golang-migrate/migrate
