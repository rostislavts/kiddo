import { Brain, Database, Search, ShieldCheck, Sparkles, Stars, Orbit } from "lucide-react";
import { cn } from "@/lib/utils";

export function Robot({ className }: { className?: string }) {
  return (
    <svg
      className={cn("robot-art", className)}
      viewBox="0 0 300 280"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="151" cy="255" rx="72" ry="12" fill="#302264" opacity=".1" />
      <path
        d="M102 216L95 246Q109 255 124 247L128 219M171 219L174 247Q192 254 205 245L195 215"
        fill="#B3A0FA"
        stroke="#594189"
        strokeWidth="3"
      />
      <path
        d="M105 165Q77 167 59 195Q54 207 65 211Q76 216 84 202L110 190M197 170Q221 177 232 152Q239 141 248 150Q259 162 242 185Q226 204 194 193"
        fill="#CEC0FF"
        stroke="#594189"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="98"
        y="154"
        width="105"
        height="77"
        rx="30"
        fill="#E7DEFF"
        stroke="#594189"
        strokeWidth="3"
      />
      <rect
        x="121"
        y="177"
        width="59"
        height="29"
        rx="13"
        fill="#C1F4D7"
        stroke="#594189"
        strokeWidth="2.5"
      />
      <path d="M146 181L138 193H149L145 201L161 188H151L154 181" fill="#448B70" />
      <path d="M151 59V37" stroke="#594189" strokeWidth="5" strokeLinecap="round" />
      <circle cx="151" cy="28" r="11" fill="#FFC966" stroke="#594189" strokeWidth="3" />
      <rect
        x="62"
        y="92"
        width="26"
        height="46"
        rx="12"
        fill="#B6A1F3"
        stroke="#594189"
        strokeWidth="3"
      />
      <rect
        x="217"
        y="92"
        width="24"
        height="46"
        rx="12"
        fill="#B6A1F3"
        stroke="#594189"
        strokeWidth="3"
      />
      <rect
        x="77"
        y="58"
        width="149"
        height="112"
        rx="42"
        fill="#EDE7FF"
        stroke="#594189"
        strokeWidth="3.5"
      />
      <path d="M103 74Q151 57 200 76" stroke="white" strokeWidth="7" strokeLinecap="round" />
      <rect x="94" y="87" width="114" height="62" rx="25" fill="#382854" />
      <path
        d="M115 109Q121 96 128 109M174 109Q181 96 187 109"
        stroke="#A7EDDB"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M141 121Q151 132 163 121" stroke="#A7EDDB" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="112" cy="123" rx="8" ry="4" fill="#E79CD0" opacity=".7" />
      <ellipse cx="188" cy="123" rx="8" ry="4" fill="#E79CD0" opacity=".7" />
    </svg>
  );
}
const icons = {
  brain: Brain,
  data: Database,
  detective: Search,
  shield: ShieldCheck,
  sparkles: Sparkles,
};
export function WorldArt({
  visual = "robot",
  color = "violet",
  className,
}: {
  visual?: string;
  color?: string;
  className?: string;
}) {
  const Icon = icons[visual as keyof typeof icons] || Orbit;
  return (
    <div className={cn("world-art", `tone-${color}`, className)} aria-hidden="true">
      <span className="art-orbit" />
      <span className="art-dot dot-one" />
      <span className="art-dot dot-two" />
      <Stars className="art-stars" size={22} />
      {visual === "robot" ? (
        <Robot />
      ) : (
        <div className="world-symbol">
          <Icon size={58} strokeWidth={1.5} />
        </div>
      )}
      <Sparkles className="art-sparkle" size={18} />
    </div>
  );
}
