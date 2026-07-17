import { clearAdminSession } from "../../../_core/admin-auth";

export async function POST() {
  await clearAdminSession();
  return Response.json({ ok: true });
}
