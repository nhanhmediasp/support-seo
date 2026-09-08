import { createHash } from "node:crypto";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const cloudinarySignature = (params: Record<string, string>, secret: string) => {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== "" && value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${serialized}${secret}`).digest("hex");
};

const normalizeImageUrl = (value: string) => {
  const parsed = new URL(value);
  const driveFileMatch = parsed.hostname === "drive.google.com" ? parsed.pathname.match(/^\/file\/d\/([^/]+)/) : null;
  if (driveFileMatch) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileMatch[1])}`;
  return value;
};

export async function POST(request: Request) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CLOUDINARY_FOLDER || "air-sea/worklogs";
  if (!cloudName || !apiKey || !apiSecret) return Response.json({ error: "Chưa cấu hình Cloudinary trên server." }, { status: 503 });

  try {
    const body = await request.json() as { imageUrl?: string };
    const imageUrl = String(body.imageUrl || "").trim();
    const sourceUrl = normalizeImageUrl(imageUrl);
    const parsedUrl = new URL(sourceUrl);
    if (!/^https?:$/.test(parsedUrl.protocol)) throw new Error("Link ảnh phải bắt đầu bằng http:// hoặc https://");

    const sourceResponse = await fetch(parsedUrl, { redirect: "follow" });
    if (!sourceResponse.ok) throw new Error(`Không tải được ảnh từ link này (${sourceResponse.status}).`);
    const contentType = sourceResponse.headers.get("content-type") || "";
    const contentLength = Number(sourceResponse.headers.get("content-length") || 0);
    if (!contentType.startsWith("image/")) throw new Error("Link không trỏ tới file hình ảnh.");
    if (contentLength > MAX_IMAGE_BYTES) throw new Error("Ảnh vượt quá giới hạn 10MB.");
    const imageBuffer = Buffer.from(await sourceResponse.arrayBuffer());
    if (imageBuffer.byteLength > MAX_IMAGE_BYTES) throw new Error("Ảnh vượt quá giới hạn 10MB.");

    const timestamp = String(Math.floor(Date.now() / 1000));
    const signatureParams = { folder, timestamp };
    const formData = new FormData();
    formData.append("file", new Blob([imageBuffer], { type: contentType }));
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp);
    formData.append("folder", folder);
    formData.append("signature", cloudinarySignature(signatureParams, apiSecret));
    const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
    const result = await uploadResponse.json() as { secure_url?: string; error?: { message?: string } };
    if (!uploadResponse.ok || !result.secure_url) throw new Error(result.error?.message || "Cloudinary không nhận ảnh.");
    return Response.json({ url: result.secure_url });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể upload ảnh." }, { status: 400 });
  }
}
