function getAdminToken(env) {
  return env.ADMIN_TOKEN || env.BATTLE_FES_ADMIN_TOKEN || "";
}

export function isAdminAuthorized(request, env) {
  const expected = getAdminToken(env);
  if (!expected) return false;

  const authHeader = request.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") && authHeader.slice(7) === expected;
}

export function requireAdmin(request, env) {
  if (isAdminAuthorized(request, env)) return null;

  return new Response(
    JSON.stringify({
      ok: false,
      error: "Unauthorized",
    }),
    {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}
