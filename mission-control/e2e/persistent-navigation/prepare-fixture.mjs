import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";

// Mutable fixtures and compiler caches must not trigger Tailwind's source scanner or dev HMR.
const target = path.resolve("test-results/navigation-fixture");
mkdirSync("test-results/navigation-tmp", { recursive: true });
cpSync(path.resolve("e2e/fixtures/factory-root"), target, { recursive: true });
