import Knex from "knex";
import { getAllTables } from "./mysql";
import { validateTables } from "./validate";
import sort from "./toposort";
import stringify from "json-stable-stringify";

// import { generateDbMetadata } from "./generate";

const knex = Knex({
  client: "mysql",
  connection: {
    user: 'root',
  },
});

async function main(database: string) {
  let tablesToExclude = ['knex_migrations', 'knex_migrations_lock', 'mv_facilitybookablesports', 'mv_facilitybookableevents', 'mv_bookableeventsessions']
  let tables = await getAllTables(database, knex, tablesToExclude);

  validateTables(tables);
  const sorted = sort(tables, {
    key(t) {
      return t.name;
    },
    dependencies(t) {
      return t.foreignKeys.map(f => f.foreignTable);
    },
  });
  for (const error of sorted.errors) {
    console.error(error)
  }
  tables = sorted.sorted;

  console.log(stringify(tables));
}

main("schematest2")
    .catch((err: Error) => {
      console.error(err);
      process.exit();
    })
    .finally(() => knex.destroy())
