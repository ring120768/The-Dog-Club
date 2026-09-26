import { currentAccount } from "@/lib/auth";
import { database } from "@/lib/database";
import {
  createOperatorExport,
  OperatorExportError,
} from "@/lib/operator-export";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ club: string }> },
) {
  const account = await currentAccount();
  if (!account) return new Response("Sign in required.", { status: 401 });
  const { club } = await params;
  try {
    const archive = await createOperatorExport(
      await database(),
      account.id,
      club,
    );
    const date = archive.generatedAt.slice(0, 10);
    const safeClub = archive.clubId.replace(/[^a-zA-Z0-9_-]/g, "-");
    return Response.json(archive, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="dog-club-${safeClub}-${date}.json"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof OperatorExportError)
      return new Response(error.message, {
        status: error.message === "Operator was not found." ? 404 : 403,
      });
    throw error;
  }
}
