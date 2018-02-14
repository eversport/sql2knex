import { IndexType, Table } from "./types";

// both postgres and mysql have something like 64 here…
const MaxKeyNameLength = 60;
const longIndexNames = new Map<string, number>();

function generateIndexName(prefix: string, table: string, columns: Array<string>) {
  let idxName = `${prefix}_${table}_${columns.join("_")}`;
  if (idxName.length > MaxKeyNameLength) {
    idxName = idxName.substr(0, MaxKeyNameLength);
    longIndexNames.set(idxName, (longIndexNames.get(idxName) || 0) + 1);
    idxName += longIndexNames.get(idxName);
  }
  return idxName;
}

function generateCreateTable(table: Table): string {
  let code = `knex.schema.createTable(${JSON.stringify(table.name)}, t => {\n`;

  for (const c of table.columns) {
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

  code += "\n";

  for (const i of table.indices) {
    if (i.type === IndexType.FullText) {
      continue;
    }
    const fn =
      i.type === IndexType.Primary ? "primary" : i.type === IndexType.Unique ? "unique" : "index";
    const idxName = generateIndexName(
      i.type === IndexType.Unique ? "uq" : "ix",
      table.name,
      i.columns,
    );
    const columns = JSON.stringify(i.columns);
    code += `  t.${fn}(${columns}, "${idxName}");\n`;
  }

  code += `})`;
  return code;
}

function generateForeignKeys(table: Table): string | null {
  if (!table.foreignKeys.length) {
    return null;
  }
  let code = `knex.schema.alterTable(${JSON.stringify(table.name)}, t => {\n`;
  for (const f of table.foreignKeys) {
    const idxName = generateIndexName("fk", table.name, f.columns);
    const columns = JSON.stringify(f.columns);
    const foreignTable = JSON.stringify(f.foreignTable);
    const foreignColumns = JSON.stringify(f.foreignColumns);
    const onUpdate = JSON.stringify(f.onUpdate);
    const onDelete = JSON.stringify(f.onDelete);
    code += `  t.foreign(${columns}, "${idxName}").references(${foreignColumns}).inTable(${foreignTable}).onUpdate(${onUpdate}).onDelete(${onDelete});\n`;
  }
  code += `})`;
  return code;
}

function generateRawStatements(table: Table): Array<string> {
  const statements: Array<string> = [];

  // generate a raw statement for `datetime` columns with `ON UPDATE CURRENT_TIMESTAMP`
  for (const c of table.columns) {
    if (c.type.type === "dateTime" && c.onUpdate === "CURRENT_TIMESTAMP") {
      statements.push(
        `knex.raw("ALTER TABLE \`${table.name}\` CHANGE \`${c.name}\` \`${
          c.name
        }\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")`,
      );
    }
  }

  // generate a raw statement for `FULLTEXT` indices
  for (const i of table.indices) {
    if (i.type === IndexType.FullText) {
      const idxName = generateIndexName("ft", table.name, i.columns);
      const cols = i.columns.join(", ");
      statements.push(
        `knex.raw("ALTER TABLE \`${table.name}\` ADD FULLTEXT INDEX \`${idxName}\`(${cols})")`,
      );
    }
  }

  return statements;
}

export function generateKnexCode(tables: Array<Table>): string {
  const statements: Array<string> = [];
  // first, generate the create table statements
  for (const t of tables) {
    statements.push(generateCreateTable(t));
  }
  // then generate the foreign keys, so we don’t get errors
  for (const t of tables) {
    const stmt = generateForeignKeys(t);
    if (stmt) {
      statements.push(stmt);
    }
  }
  // and lastly generate some mysql specific things that might not be doable in other database systems
  for (const t of tables) {
    statements.push(...generateRawStatements(t));
  }

  return `const statements = [${statements.map(stmt => `() => ${stmt}`).join(",\n")}];`;
}
