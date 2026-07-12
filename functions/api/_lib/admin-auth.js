function getAdminToken(env) {
  return env.ADMIN_TOKEN || env.BATTLE_FES_ADMIN_TOKEN || "";
}

function getOwnerToken(env) {
  return env.OWNER_TOKEN || env.BATTLE_FES_OWNER_TOKEN || "";
}

function bearerToken(request) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

export function getAdminPrincipal(request, env) {
  const supplied = bearerToken(request);
  if (!supplied) return null;

  const ownerToken = getOwnerToken(env);
  if (ownerToken && supplied === ownerToken) {
    return { role: "owner", teamId: null, teamName: null };
  }

  const adminToken = getAdminToken(env);
  if (adminToken && supplied === adminToken) {
    return { role: "leader", teamId: null, teamName: null };
  }
  return null;
}

export function isAdminAuthorized(request, env) {
  return Boolean(getAdminPrincipal(request, env));
}

export function isOwnerAuthorized(request, env) {
  return getAdminPrincipal(request, env)?.role === "owner";
}

export function unauthorizedAdminResponse(error = "Unauthorized") {
  return new Response(
    JSON.stringify({ ok: false, error }),
    {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}

export function requireAdmin(request, env) {
  if (isOwnerAuthorized(request, env)) return null;
  return unauthorizedAdminResponse();
}
