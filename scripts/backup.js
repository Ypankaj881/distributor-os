// Exports every collection to JSON files:  backups/<database>/<timestamp>/<collection>.json
//   npm run db:backup
//
// Why: the FREE Atlas tier (M0) has no automatic backups. Run this regularly
// (e.g. every evening) until you move to a paid tier with snapshots, and keep
// the files somewhere safe (they contain customer data and password HASHES).
// Uses Extended JSON so ObjectIds and dates survive a restore.
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { runScript } from "./_shared.js";

const { EJSON } = mongoose.mongo.BSON;

await runScript(async () => {
  const db = mongoose.connection.db;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.resolve("backups", mongoose.connection.name, stamp);
  fs.mkdirSync(dir, { recursive: true });

  const collections = (await db.listCollections().toArray()).map((c) => c.name).sort();
  for (const name of collections) {
    const docs = await db.collection(name).find().toArray();
    fs.writeFileSync(path.join(dir, `${name}.json`), EJSON.stringify(docs, { relaxed: false }, 0));
    console.log(`✔ ${name.padEnd(16)} ${docs.length} documents`);
  }
  console.log(`\nSaved to ${dir}`);
  console.log("Restore a collection with: mongoimport --uri <MONGODB_URI> --db <db> --collection <name> --jsonArray --file <file>");
});
