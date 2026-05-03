import { getSupabaseConfigStatus } from "@/lib/env";
import { requireSupabaseBrowserClient } from "@/lib/supabase/client";

const maxImageSizeBytes = 8 * 1024 * 1024;

function getSafeFileName(name: string) {
  const fallback = "image";
  const trimmed = name.trim() || fallback;
  const dotIndex = trimmed.lastIndexOf(".");
  const baseName = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
  const extension = dotIndex > 0 ? trimmed.slice(dotIndex + 1).toLowerCase() : "png";
  const safeBaseName = baseName
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${safeBaseName || fallback}.${extension}`;
}

export async function uploadImageAsset(documentId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("只能上传图片文件。");
  }

  if (file.size > maxImageSizeBytes) {
    throw new Error("图片不能超过 8MB。");
  }

  const supabase = requireSupabaseBrowserClient();
  const config = getSupabaseConfigStatus();

  if (!config.configured) {
    throw new Error("Supabase 尚未配置。");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("请先登录。");
  }

  const fileName = getSafeFileName(file.name);
  const storagePath = `${user.id}/${documentId}/${crypto.randomUUID()}-${fileName}`;
  const { error: uploadError } = await supabase.storage.from(config.storageBucket).upload(storagePath, file, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    throw uploadError;
  }

  const [signedUrlResult, assetResult] = await Promise.all([
    supabase.storage.from(config.storageBucket).createSignedUrl(storagePath, 60 * 60 * 24 * 365),
    supabase.from("assets").insert({
      user_id: user.id,
      document_id: documentId,
      asset_type: "image",
      bucket: config.storageBucket,
      storage_path: storagePath,
      file_name: file.name || fileName,
      mime_type: file.type,
      size_bytes: file.size
    })
  ]);

  if (signedUrlResult.error) {
    throw signedUrlResult.error;
  }

  if (assetResult.error) {
    throw assetResult.error;
  }

  return signedUrlResult.data.signedUrl;
}
