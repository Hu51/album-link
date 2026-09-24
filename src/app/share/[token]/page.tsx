import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { resolveShareToken } from "@/lib/shares";
import { ShareGallery } from "@/components/share-gallery";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = resolveShareToken(token);

  if (!share) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c0b0a] px-4 text-center text-[#f4efe6]">
        <p className="text-xs uppercase tracking-[0.28em] text-[#c4a574]">
          {APP_NAME}
        </p>
        <h1 className="mt-3 font-heading text-3xl">Link not valid</h1>
        <p className="mt-3 max-w-md text-[#b7aea0]">
          This share link was rolled, deleted, expired, or never existed.
        </p>
        <Link
          href="/"
          className="mt-8 text-sm text-[#c4a574] underline-offset-4 hover:underline"
        >
          Back home
        </Link>
      </div>
    );
  }

  return (
    <ShareGallery
      appName={APP_NAME}
      token={token}
      shareName={share.name}
      kind={share.kind}
      shareExpiresAt={share.shareExpiresAt}
      maxDownloadResolution={share.maxDownloadResolution}
      events={share.events}
    />
  );
}
