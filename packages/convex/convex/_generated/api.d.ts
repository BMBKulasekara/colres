/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_activity from "../admin/activity.js";
import type * as admin_contributions from "../admin/contributions.js";
import type * as admin_documents from "../admin/documents.js";
import type * as admin_organizations from "../admin/organizations.js";
import type * as admin_search from "../admin/search.js";
import type * as admin_stats from "../admin/stats.js";
import type * as admin_users from "../admin/users.js";
import type * as chats from "../chats.js";
import type * as comments from "../comments.js";
import type * as contributions from "../contributions.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as goals from "../goals.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bibtexParse from "../lib/bibtexParse.js";
import type * as lib_cascade from "../lib/cascade.js";
import type * as lib_chatAttachments from "../lib/chatAttachments.js";
import type * as lib_chatMentions from "../lib/chatMentions.js";
import type * as lib_citations from "../lib/citations.js";
import type * as lib_contributions from "../lib/contributions.js";
import type * as lib_externalData from "../lib/externalData.js";
import type * as lib_goalPolicy from "../lib/goalPolicy.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_searchText from "../lib/searchText.js";
import type * as lib_sharing from "../lib/sharing.js";
import type * as lib_templateCatalog from "../lib/templateCatalog.js";
import type * as lib_templateContent from "../lib/templateContent.js";
import type * as lib_templateTypes from "../lib/templateTypes.js";
import type * as lib_trashPolicy from "../lib/trashPolicy.js";
import type * as lib_versionPolicy from "../lib/versionPolicy.js";
import type * as notifications from "../notifications.js";
import type * as organizations from "../organizations.js";
import type * as references from "../references.js";
import type * as research from "../research.js";
import type * as search from "../search.js";
import type * as seedTemplates from "../seedTemplates.js";
import type * as sharing from "../sharing.js";
import type * as templates from "../templates.js";
import type * as trash from "../trash.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/activity": typeof admin_activity;
  "admin/contributions": typeof admin_contributions;
  "admin/documents": typeof admin_documents;
  "admin/organizations": typeof admin_organizations;
  "admin/search": typeof admin_search;
  "admin/stats": typeof admin_stats;
  "admin/users": typeof admin_users;
  chats: typeof chats;
  comments: typeof comments;
  contributions: typeof contributions;
  crons: typeof crons;
  documents: typeof documents;
  goals: typeof goals;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/bibtexParse": typeof lib_bibtexParse;
  "lib/cascade": typeof lib_cascade;
  "lib/chatAttachments": typeof lib_chatAttachments;
  "lib/chatMentions": typeof lib_chatMentions;
  "lib/citations": typeof lib_citations;
  "lib/contributions": typeof lib_contributions;
  "lib/externalData": typeof lib_externalData;
  "lib/goalPolicy": typeof lib_goalPolicy;
  "lib/notify": typeof lib_notify;
  "lib/searchText": typeof lib_searchText;
  "lib/sharing": typeof lib_sharing;
  "lib/templateCatalog": typeof lib_templateCatalog;
  "lib/templateContent": typeof lib_templateContent;
  "lib/templateTypes": typeof lib_templateTypes;
  "lib/trashPolicy": typeof lib_trashPolicy;
  "lib/versionPolicy": typeof lib_versionPolicy;
  notifications: typeof notifications;
  organizations: typeof organizations;
  references: typeof references;
  research: typeof research;
  search: typeof search;
  seedTemplates: typeof seedTemplates;
  sharing: typeof sharing;
  templates: typeof templates;
  trash: typeof trash;
  users: typeof users;
  versions: typeof versions;
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
