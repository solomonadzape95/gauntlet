/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as automation from "../automation.js";
import type * as cashouts from "../cashouts.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as gameLoop from "../gameLoop.js";
import type * as http from "../http.js";
import type * as matchSim from "../matchSim.js";
import type * as matchdays from "../matchdays.js";
import type * as passes from "../passes.js";
import type * as poolStates from "../poolStates.js";
import type * as rosters from "../rosters.js";
import type * as seed from "../seed.js";
import type * as sui_actions from "../sui_actions.js";
import type * as tournaments from "../tournaments.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  automation: typeof automation;
  cashouts: typeof cashouts;
  crons: typeof crons;
  events: typeof events;
  gameLoop: typeof gameLoop;
  http: typeof http;
  matchSim: typeof matchSim;
  matchdays: typeof matchdays;
  passes: typeof passes;
  poolStates: typeof poolStates;
  rosters: typeof rosters;
  seed: typeof seed;
  sui_actions: typeof sui_actions;
  tournaments: typeof tournaments;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
