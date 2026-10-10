export function isConfigured() {
  return !!(
    process.env.DATABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
export function thresholds() {
  const mastered = Number(process.env.MASTERY_THRESHOLD || 80);
  const completed = Number(process.env.COMPLETION_THRESHOLD || 60);
  if (
    !Number.isInteger(mastered) ||
    !Number.isInteger(completed) ||
    completed < 0 ||
    mastered > 100 ||
    completed > mastered
  )
    throw new Error("Invalid mastery thresholds");
  return { mastered, completed };
}
export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
