import { IndexType, Column, Table } from "./types";

function generateCreateTable(table: Table): string {
  let code = `knex.schema.createTable(${JSON.stringify(table.name)}, t => {\n`;

  for (const c of table.columns) {
    if (c.onUpdate) {
      continue;
    }
    const name = JSON.stringify(c.name);
    code += "  t";
    let { type } = c;
    if (type.type === "string") {
      code += `.string(${name}, ${type.length})`;
    } else if (type.type === "decimal") {
      code += `.decimal(${name}, ${type.precision[0]}, ${type.precision[1]})`;
    } else if (type.type === "enum") {
      code += `.enum(${name}, ${JSON.stringify(type.cases)})`;
    } else if (type.type === "custom") {
      const custom = JSON.stringify(type.custom);
      code += `.specificType(${name}, ${custom})`;
    } else {
      code += `.${type.type}(${name})`;
    }
    if ((type.type === "integer" || type.type === "bigInteger") && type.unsigned) {
      code += `.unsigned()`;
    }
    if (!c.nullable) {
      code += ".notNullable()";
    }
    if (c.default !== null) {
      const def =
        c.default === "CURRENT_TIMESTAMP"
          ? `knex.fn.now()`
          : type.type === "boolean" ? c.default : JSON.stringify(c.default);
      code += `.defaultTo(${def})`;
    }
    code += ";\n";
  }

  code += `})`;
  return code;
}

const IndexTypeMap = {
  [IndexType.Primary]: "primary",
  [IndexType.Index]: "index",
  [IndexType.FullText]: "fulltext",
  [IndexType.Unique]: "unique",
};

export function generateDbMetadata(tables: Array<Table>) {
  const creates = [];
  const onUpdates = [];
  const indices = [];
  const foreigns = [];

  const idKeysMap = new Map<string, Set<string>>();
  function recordId(table: string, column: string) {
    const keys = idKeysMap.get(table);
    if (keys) {
      keys.add(column);
    } else {
      idKeysMap.set(table, new Set([column]));
    }
  }

  const tablesByName = new Map<string, Table>();
  for (const t of tables) {
    const table = t.name;
    tablesByName.set(table, t);

    creates.push(`knex => ${generateCreateTable(t)}`);

    for (const i of t.indices) {
      indices.push({
        table,
        type: IndexTypeMap[i.type],
        columns: i.columns,
      });
    }

    for (const f of t.foreignKeys) {
      const { foreignTable, onDelete, onUpdate } = f;
      const column = f.columns[0];
      const foreignColumn = f.foreignColumns[0];
      recordId(table, column);
      recordId(foreignTable, foreignColumn);
      foreigns.push({
        table,
        column,
        foreignTable,
        foreignColumn,
        onDelete,
        onUpdate,
      });
    }

    for (const c of t.columns) {
      if (c.type.type === "increments") {
        recordId(table, c.name);
      }
      if (c.type.type === "dateTime" && c.onUpdate === "CURRENT_TIMESTAMP") {
        onUpdates.push({
          table,
          column: c.name,
        });
      }
    }
  }

  const idKeys = [];
  for (const [tableName, columnNames] of idKeysMap) {
    const table = tablesByName.get(tableName) as Table;
    for (const column of columnNames) {
      const definition = table.columns.find(c => c.name === column) as Column;
      idKeys.push({
        table: tableName,
        column,
        nullable: definition.nullable,
        auto: definition.type.type === "increments",
      });
    }
  }

  return {
    creates,
    onUpdates,
    indices,
    foreigns,
    idKeys,
  };
}
