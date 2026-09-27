import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getGraphAppToken } from "@/lib/graphCalendar";

type GraphUser = {
  id: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string | null;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json([]);

  try {
    const token = await getGraphAppToken();
    const escaped = query.replace(/'/g, "''");
    const params = new URLSearchParams({
      "$select": "id,displayName,mail,userPrincipalName",
      "$filter": `startswith(displayName,'${escaped}') or startswith(mail,'${escaped}') or startswith(userPrincipalName,'${escaped}')`,
      "$top": "8",
    });
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );

    if (!response.ok) {
      const graphError = (await response.json().catch(() => null)) as
        | { error?: { code?: string; message?: string } }
        | null;
      console.error("Microsoft Graph directory search failed", {
        status: response.status,
        code: graphError?.error?.code,
        message: graphError?.error?.message,
      });
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === "development"
              ? `Graph ${response.status}: ${graphError?.error?.message ?? "Directory user tidak dapat dibaca."}`
              : "Directory user tidak dapat dibaca. Pastikan User.Read.All sudah diberi admin consent.",
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { value?: GraphUser[] };
    const users = (data.value ?? [])
      .map((user) => ({
        id: user.id,
        displayName: user.displayName ?? user.mail ?? user.userPrincipalName ?? "",
        email: user.mail ?? user.userPrincipalName ?? "",
      }))
      .filter((user) => user.email);

    return NextResponse.json(users);
  } catch {
    return NextResponse.json(
      { error: "Gagal mencari user Entra ID." },
      { status: 500 }
    );
  }
}
