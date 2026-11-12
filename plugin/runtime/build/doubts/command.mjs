// Dispatcher entry of the `doubt` command.
import { err } from "./common.mjs";
import { answerDoubt } from "./answer.mjs";
import { openDoubt } from "./open.mjs";

/**
 * Dispatcher entry for `doubt open|answer`.
 * @param {{sub: "open"|"answer", project: string, epoch: number, unit?: string, id?: string, file: string, token?: string}} input
 * @param {object} [deps]
 */
export async function doubtCommand(input, deps = {}) {
  if (input?.epoch === undefined || input.epoch === null || Number.isNaN(Number(input.epoch))) throw err("USAGE", "--epoch is required");
  if (input.sub === "open") return openDoubt(input, deps);
  if (input.sub === "answer") return answerDoubt(input, deps);
  throw err("USAGE", "doubt takes open|answer");
}
