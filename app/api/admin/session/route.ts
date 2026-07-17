import { isAdminAuthenticated } from "../../../_core/admin-auth";

export async function GET() {
  return Response.json({ authenticated: await isAdminAuthenticated() });
}
