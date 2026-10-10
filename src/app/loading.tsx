import { bg } from "@/i18n/bg";
export default function Loading() {
  return (
    <div className="container section" role="status" aria-label={bg.common.loading}>
      <div className="skeleton" style={{ height: 38, width: "50%", marginBottom: 25 }} />
      <div className="skeleton" style={{ height: 270 }} />
    </div>
  );
}
