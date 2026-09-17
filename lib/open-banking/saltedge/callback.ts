import { NextRequest, NextResponse } from "next/server";

export type SaltEdgeCallbackType =
  | "success"
  | "fail"
  | "destroy"
  | "notify"
  | "provider-changes"
  | "consent-changes";

export async function handleSaltEdgeCallback(
  request: NextRequest,
  callbackType: SaltEdgeCallbackType,
) {
  try {
    const payload = await request.json();

    console.log(`[Salt Edge] ${callbackType} callback`, payload);

    // TODO: Verify Salt Edge callback signature before processing the payload.
    // TODO: For connection-related callbacks, trigger idempotent account/transaction sync.
    // TODO: Persist relevant provider/consent state changes once the sync layer is implemented.

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error(`[Salt Edge] ${callbackType} callback: invalid JSON payload`, error);

    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
