import { NextRequest } from "next/server";
import { handleSaltEdgeCallback } from "@/lib/open-banking/saltedge/callback";

export async function POST(request: NextRequest) {
  return handleSaltEdgeCallback(request, "consent-changes");
}
