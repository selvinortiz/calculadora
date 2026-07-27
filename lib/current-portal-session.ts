import { cookies } from "next/headers";
import {
  getPortalSessionSecret,
  PORTAL_SESSION_COOKIE,
  verifyPortalSession,
  type PortalSession,
} from "./portal-auth";

export async function getCurrentPortalSession(): Promise<PortalSession | null> {
  const token = (await cookies()).get(PORTAL_SESSION_COOKIE)?.value;

  try {
    return verifyPortalSession(token, getPortalSessionSecret());
  } catch {
    return null;
  }
}
