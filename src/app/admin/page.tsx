import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminHomePage() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Link href="/admin/groups">
        <Card className="h-full transition hover:border-stone-400">
          <CardHeader>
            <CardTitle>Groups</CardTitle>
            <CardDescription>
              Share links for a chat, and the albums each group can see.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <Link href="/admin/people">
        <Card className="h-full transition hover:border-stone-400">
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>
              Personal links, each with their own groups and download cap.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <Link href="/admin/folders">
        <Card className="h-full transition hover:border-stone-400">
          <CardHeader>
            <CardTitle>Folders</CardTitle>
            <CardDescription>
              Each album, with the groups and people who can open it.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  );
}
