import { Table, IndexType, Column } from "./types";

export function validateTables(tables: Array<Table>) {
  const byName = new Map<string, Table>();
  for (const t of tables) {
    validateIndices(t);
    byName.set(t.name, t);
  }

  // validate foreign keys so they have the same data type
  // this is a problem because knex `increments` uses `unsigned` while the
  // schema so far did not, so set all of those to unsigned!
  for (const t of tables) {
    const columns = new Set<string>();
    for (let i = 0; i < t.foreignKeys.length; i++) {
      const key = t.foreignKeys[i];
      const column = key.columns[0];
      if (columns.has(column)) {
        console.warn(`Duplicate ForeignKey on \`${t.name}(${column})\``);
        t.foreignKeys.splice(i, 1);
        i--;
        continue;
      }
      columns.add(column);
      // explicitly cast, because we know these are non-null
      const foreignTable = byName.get(key.foreignTable) as Table;
      const foreignColumn = foreignTable.columns.find(
        c => c.name === key.foreignColumns[0],
      ) as Column;
      const thisColumn = t.columns.find(c => c.name === column) as Column;
      if (foreignColumn.type.type === "increments") {
        if (thisColumn.type.type === "integer") {
          thisColumn.type.unsigned = true;
        }
      }
    }
  }
}

export function validateIndices(table: Table) {
  const { name, indices } = table;
  const hasIncrements = table.columns.some(c => c.type.type === "increments");

  // warn and remove duplicate indices
  const indicesByColumn = new Set<string>();
  for (let i = 0; i < indices.length; i++) {
    const { columns, type } = indices[i];
    // remove primary key if we have a `increments` column
    if (type === IndexType.Primary && hasIncrements) {
      if (columns.length > 1) {
        console.warn(
          `Removing compound primary key \`${name}(${columns.join(
            ", ",
          )})\` because we have an AUTO_INCREMENT column`,
        );
      }
      indices.splice(i, 1);
      i--;
    }
    if (columns.length > 1 || type === IndexType.FullText) {
      continue;
    }
    const column = columns[0];
    const existing = indicesByColumn.has(column);
    if (existing) {
      console.warn(`Duplicate Index on \`${name}(${column})\``);
      indices.splice(i, 1);
      i--;
    } else {
      indicesByColumn.add(column);
    }
  }
}
