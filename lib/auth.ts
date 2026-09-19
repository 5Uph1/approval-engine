import { jwtVerify, SignJWT } from "jose";

const secretValue = process.env.JWT_SECRET;
if (!secretValue || secretValue.length < 10) {
  throw new Error("JWT_SECRET tidak ada");
}

const secret = new TextEncoder().encode(secretValue);

export type JwtPayload = {
  sub: string;
  email: string;
  roles: string[];
};

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    roles: payload.roles,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: payload.email as string,
      roles: (payload.roles as string[]) ?? [],
    };
  } catch {
    return null;
  }
}
