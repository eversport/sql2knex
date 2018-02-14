import Knex from "knex";
import { getAllTables } from "./mysql";
import { generateKnexCode } from "./generate";
import { validateTables } from "./validate";

const knex = Knex({
  client: "mysql",
  connection: {
    user: "root",
  },
});

async function main(database: string) {
  const tables = await getAllTables(database, knex);
  validateTables(tables)
  const code = generateKnexCode(tables);
  console.log(code);
  // const run = new Function(`return (async knex => {${code}})`)();
  // return run(knex)
}

main("schematest").then(
  () => process.exit(),
  (err: Error) => {
    console.error(err);
    process.exit();
  },
);
