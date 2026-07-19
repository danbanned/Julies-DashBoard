// /app/api/posts/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { requireAdmin } from "../../../lib/session";

export const dynamic = "force-dynamic";

// GET – list posts with poll aggregates
export async function GET() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      caption: true,
      coverImageUrl: true,
      createdAt: true,
      author: { select: { name: true } },
      pollResponses: { select: { option: true } },
    },
  });

  const enriched = posts.map((post) => {
    const counts = { please_post: 0, not_like: 0, thank_you: 0 };
    post.pollResponses.forEach((r) => {
      if (counts.hasOwnProperty(r.option)) counts[r.option]++;
    });
    const total = counts.please_post + counts.not_like + counts.thank_you;
    return { ...post, pollStats: { ...counts, total }, pollResponses: undefined };
  });

  return NextResponse.json({ posts: enriched });
}

// POST – unified: either create a post (admin) or record a vote
export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // --- VOTE ---
  if (action === "vote") {
    const body = await req.json();
    const { postId, option, visitorId } = body;
    if (!postId || !option || !visitorId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const valid = ["please_post", "not_like", "thank_you"];
    if (!valid.includes(option)) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 });
    }
    try {
      const response = await prisma.pollResponse.upsert({
        where: { postId_visitorId: { postId, visitorId } },
        update: { option },
        create: { postId, option, visitorId },
      });
      return NextResponse.json({ ok: true, response });
    } catch (e) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
  }

  // --- CREATE POST (admin only) ---
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const contentType = req.headers.get("content-type") || "";
  let title = "";
  let caption = "";
  let coverImageUrl = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    title = String(form.get("title") || "");
    caption = String(form.get("caption") || "");
    const file = form.get("cover");
    if (file && typeof file === "object" && file.size > 0) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
          { error: "image upload needs Vercel Blob (BLOB_READ_WRITE_TOKEN) — paste an image URL instead" },
          { status: 501 }
        );
      }
      const { put } = await import("@vercel/blob");
      const blob = await put(`posts/${Date.now()}-${file.name}`, file, { access: "public" });
      coverImageUrl = blob.url;
    }
  } else {
    const b = await req.json().catch(() => ({}));
    title = String(b.title || "");
    caption = String(b.caption || "");
    coverImageUrl = b.coverImageUrl || null;
  }

  if (!title.trim() || !caption.trim()) {
    return NextResponse.json({ error: "title and caption required" }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: { authorId: admin.id, title: title.slice(0, 200), caption: caption.slice(0, 4000), coverImageUrl },
  });
  return NextResponse.json({ ok: true, post });
}

// DELETE – remove a post (admin only). Poll responses have no cascade, so
// they're cleared first in a transaction.
export async function DELETE(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || (await req.json().catch(() => ({}))).id;
  if (!id) return NextResponse.json({ error: "post id required" }, { status: 400 });

  try {
    await prisma.$transaction([
      prisma.pollResponse.deleteMany({ where: { postId: id } }),
      prisma.post.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }
}