import "server-only";
import { requirePermission } from "@/lib/auth/authorize";
import { issueDocumentToken, verifyDocumentToken } from "./document-token";
import { limitPublicRequest } from "./rate-limit";

export async function authorizeDocument(resource: string, permission: string, token?: string) {
  await limitPublicRequest("documents", 60);
  if (token && verifyDocumentToken(token, resource)) return token;
  const user = await requirePermission(permission);
  // A read-only user may view a receipt, but must not mint a signing capability.
  return user.permissions.includes(permission.replace(/\.view$/, ".edit")) ? issueDocumentToken(resource) : undefined;
}

export function receiptResource(kind: string, id: string) { return `receipt:${kind}:${id}`; }
export function salaryResource(weekId: string, employeeId: string) { return `salary:${weekId}:${employeeId}`; }

export function validPngSignature(value: string) {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const bytes = Buffer.from(value.slice("data:image/png;base64,".length), "base64");
  return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}
