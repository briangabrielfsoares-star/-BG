import { createAdminSession, verifyAdminPassword } from "../../../_core/admin-auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { password?: string };
  if (!payload.password || !(await verifyAdminPassword(payload.password))) {
    return Response.json({ error: "Senha incorreta." }, { status: 401 });
  }
  await createAdminSession();
  return Response.json({ ok: true });
}
