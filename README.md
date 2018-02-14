# SQL2Knex

This is a small tool that generates knex.js code from a database.
So far it supports MySQL databases.

Apart from generating JS code, it also prints warnings about the existing database
schema, such as duplicate keys.

You can run it with:
```sh
$ ts-node src/index.ts
```
