import Knex from "knex";
import { getAllTables } from "./mysql";
import { validateTables } from "./validate";
import sort from "./toposort";
// import { generateDbMetadata } from "./generate";

const knex = Knex({
  client: "mysql",
  connection: {
    user: "root",
  },
});

async function main(database: string) {
  let tables = await getAllTables(database, knex);
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

  console.log(JSON.stringify(tables));
}

main("schematest2").then(
  () => process.exit(),
  (err: Error) => {
    console.error(err);
    process.exit();
  },
);
