#!/usr/bin/env node
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(root, "plugin/runtime/event-vocabulary.json");
const output = path.join(root, "mission-control/src/lib/events/event-vocabulary.json");
await mkdir(path.dirname(output), { recursive: true });
await copyFile(source, output);
console.log(path.relative(root, output));
