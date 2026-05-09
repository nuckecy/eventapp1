// Feedback history (EC-09).
//
// Returns the full thread of admin feedback entries for a request,
// joined to author names so the Lead can see who said what.
//
// SECURITY:
// - Tenant-scoped: the request join filters by tenant.
// - Caller must verify the user is allowed to read this request
//   (e.g. submitter, admin, or super) BEFORE invoking. The data
//   layer trusts the caller — this matches our convention for the
//   rest of the request data layer.

import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cemRequestFeedback, cemRequests, coreUsers } from "@/db/schema";

export type FeedbackEntry = {
  id: string;
  content: string;
  created_at: Date | null;
  author_id: string;
  author_name: string | null;
};

export async function listFeedbackForRequest(
  tenantId: string,
  requestId: string,
): Promise<FeedbackEntry[]> {
  // Inner-join with the request itself to enforce tenant scope: a
  // feedback row belongs to a request, which belongs to a tenant; we
  // require both before returning anything.
  const rows = await db
    .select({
      id: cemRequestFeedback.id,
      content: cemRequestFeedback.content,
      created_at: cemRequestFeedback.created_at,
      author_id: cemRequestFeedback.author_id,
      author_name: coreUsers.name,
    })
    .from(cemRequestFeedback)
    .innerJoin(
      cemRequests,
      and(
        eq(cemRequests.id, cemRequestFeedback.request_id),
        eq(cemRequests.tenant_id, tenantId),
      ),
    )
    .leftJoin(coreUsers, eq(coreUsers.id, cemRequestFeedback.author_id))
    .where(eq(cemRequestFeedback.request_id, requestId))
    .orderBy(asc(cemRequestFeedback.created_at));
  return rows;
}
