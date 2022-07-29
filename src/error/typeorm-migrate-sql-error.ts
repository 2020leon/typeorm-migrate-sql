export default class TypeormMigrateSqlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TypeormMigrateSqlError';
  }
}
