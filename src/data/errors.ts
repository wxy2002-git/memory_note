export function getReadableError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("questions_user_title_key_unique")) {
      return "已存在同名问题。";
    }

    if (error.message.includes("answer_articles_question_title_key_unique")) {
      return "该问题下已有同名回答标题。";
    }

    if (error.message.includes("derived_question_links_unique")) {
      return "当前正文已经记录过这个衍生问题。";
    }

    if (error.message.includes("Supabase is not configured")) {
      return "Supabase 还没有配置，请先填写 .env.local。";
    }

    return error.message;
  }

  return "操作失败，请稍后重试。";
}
