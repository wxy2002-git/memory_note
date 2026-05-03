import type { Config, Context } from "@netlify/functions";
import {
  deleteArticleCascade,
  getAdminClient,
  HttpError,
  jsonResponse,
  readIdFromRequest,
  requireAuthenticatedUser
} from "./_shared/delete-records";

export default async (req: Request, _context: Context) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const admin = getAdminClient();
    const user = await requireAuthenticatedUser(admin, req);
    const articleId = await readIdFromRequest(req, "articleId");
    const result = await deleteArticleCascade(admin, articleId, user.id);

    return jsonResponse(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message }, error.status);
    }

    console.error(error);
    return jsonResponse({ error: "删除回答失败，请稍后重试。" }, 500);
  }
};

export const config: Config = {
  path: "/api/delete-article"
};
