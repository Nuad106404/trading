import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const authed = cookieStore.get("um_auth")?.value === "1";
  const role = cookieStore.get("um_role")?.value;

  if (!authed) redirect("/login");
  redirect(role === "user" ? "/profile" : "/admin/users");
}
