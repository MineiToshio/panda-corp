// units/common.mjs: constants and the error helper shared by the units modules (see ../units.mjs).

export const err = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);

export const RELEASE_VAR = "PANDACORP_OWNER_RELEASE_OK";
export const REVIEW_KINDS = ["review", "audit", "deferred-review"];
