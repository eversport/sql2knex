import Knex from "knex";
import { IndexType, Table, Index, Column, ForeignKey, ColumnType } from "./types";

export async function getAllTables(database: string, knex: Knex): Promise<Array<Table>> {
  const tableNames: Array<string> = await knex
    .select("table_name")
    .from("information_schema.tables")
    .pluck("table_name")
    .where({ table_schema: database, table_type: "base table" });
  return Promise.all(tableNames.map(name => getTable(database, name, knex)));
}

export async function getTable(database: string, table: string, knex: Knex): Promise<Table> {
  return {
    name: table,
    columns: await getColumns(database, table, knex),
    indices: await getIndices(database, table, knex),
    foreignKeys: await getForeignKeys(database, table, knex),
  };
}

function enumCases(string: string): Array<string> {
  // wow, this is just wrong on so many levels
  return new Function("_enum", `return _${string}`)((...args: Array<string>) => args);
}

async function getColumns(database: string, table: string, knex: Knex): Promise<Array<Column>> {
  const columns: Array<any> = await knex
    .select(
      "column_name",
      "is_nullable",
      "column_default",
      "data_type",
      "character_maximum_length",
      "numeric_precision",
      "numeric_scale",
      "column_type",
      "extra",
    )
    .from("information_schema.columns")
    .where({ table_schema: database, table_name: table });

  return columns.map(col => {
    let type: ColumnType = { type: "custom", custom: col.column_type };
    let onUpdate = "";
    let colDefault: string = col.column_default;
    if (col.extra === "auto_increment") {
      type = { type: "increments" };
    } else if (col.column_type === "tinyint(1)") {
      type = { type: "boolean" };
      colDefault = colDefault === "0" ? "false" : "true";
    } else if (col.data_type === "varchar") {
      type = { type: "string", length: col.character_maximum_length };
    } else if (col.column_type === "text") {
      type = { type: "text" };
    } else if (col.data_type === "decimal") {
      type = { type: "decimal", precision: [col.numeric_precision, col.numeric_scale] };
    } else if (col.column_type === "datetime") {
      type = { type: "dateTime" };
    } else if (col.column_type === "date") {
      type = { type: "date" };
    } else if (col.column_type === "float") {
      type = { type: "float" };
    } else if (col.data_type === "int") {
      type = { type: "integer", unsigned: col.column_type.includes("unsigned") };
    } else if (col.data_type === "bigint") {
      type = { type: "bigInteger", unsigned: col.column_type.includes("unsigned") };
    } else if (col.data_type === "enum") {
      type = { type: "enum", cases: enumCases(col.column_type) };
    }
    if (col.extra.startsWith("on update ")) {
      onUpdate = col.extra.slice("on update ".length);
    }
    return {
      name: col.column_name,
      type,
      nullable: col.is_nullable === "YES",
      default: colDefault,
      onUpdate,
    };
  });
}

async function getIndices(database: string, table: string, knex: Knex): Promise<Array<Index>> {
  const dbIndices: Array<any> = await knex
    .select("index_name", "column_name", "non_unique", "index_type")
    .from("information_schema.statistics")
    .orderBy("seq_in_index")
    .where({ table_schema: database, table_name: table });

  const indicesByName = new Map<string, Index>();
  for (const { non_unique, index_name, column_name, index_type } of dbIndices) {
    const existingIndex = indicesByName.get(index_name);
    if (existingIndex) {
      existingIndex.columns.push(column_name);
    } else {
      const indexType =
        index_name === "PRIMARY"
          ? IndexType.Primary
          : index_type === "FULLTEXT"
            ? IndexType.FullText
            : non_unique === 0 ? IndexType.Unique : IndexType.Index;
      indicesByName.set(index_name, {
        columns: [column_name],
        type: indexType,
      });
    }
  }
  const indices = [...indicesByName.values()];

  // sort indices: Primary -> Unique -> Index
  indices.sort(({ type: a }, { type: b }) => a - b);

  return indices;
}

async function getForeignKeys(
  database: string,
  table: string,
  knex: Knex,
): Promise<Array<ForeignKey>> {
  const dbConstraints: Array<any> = await knex
    .select(
      "rc.constraint_name",
      "update_rule",
      "delete_rule",
      "rc.referenced_table_name",
      "column_name",
      "referenced_column_name",
    )
    .from("information_schema.referential_constraints AS rc")
    .join("information_schema.key_column_usage AS kcu", j => {
      j
        .on("rc.constraint_name", "kcu.constraint_name")
        .andOn("rc.constraint_schema", "kcu.constraint_schema");
    })
    .where({
      "rc.constraint_schema": database,
      "rc.table_name": table,
    })
    .orderBy("ordinal_position");

  const constraintsByName = new Map<string, ForeignKey>();
  for (const {
    constraint_name,
    update_rule,
    delete_rule,
    referenced_table_name,
    column_name,
    referenced_column_name,
  } of dbConstraints) {
    const constraint = constraintsByName.get(constraint_name);
    if (constraint) {
      constraint.columns.push(column_name);
      constraint.foreignColumns.push(referenced_column_name);
    } else {
      constraintsByName.set(constraint_name, {
        columns: [column_name],
        foreignTable: referenced_table_name,
        foreignColumns: [referenced_column_name],
        onUpdate: update_rule,
        onDelete: delete_rule,
      });
    }
  }

  return [...constraintsByName.values()];
}
