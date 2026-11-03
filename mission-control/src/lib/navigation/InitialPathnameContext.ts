"use client";

import { createContext } from "react";

/** Pathname captured by the shell before deferred descendants can hydrate. */
export const InitialPathnameContext = createContext<string | null>(null);
