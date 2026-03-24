import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt, COOKIE_NAME } from "@/lib/auth";
import AdminTabs from "./AdminTabs";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyJwt(token) : null;

  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-[#fdfaf6] text-[#5c4a2e] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <h1 className="font-serif text-3xl">Panel de administración</h1>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="px-4 py-2 text-sm border border-[#8a6d3b] text-[#8a6d3b] rounded hover:bg-[#8a6d3b] hover:text-white transition"
            >
              Cerrar sesión
            </button>
          </form>
        </div>

        <AdminTabs />
      </div>
    </div>
  );
}
