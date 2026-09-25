import type { GarmentId } from "../../domain/studio/types";

export function GarmentGlyph({
  id,
  className = "",
}: {
  id: GarmentId;
  className?: string;
}) {
  const paths = {
    nimcha: "M24 14 37 9 45 22 53 9 66 14 64 33 66 69 46 76 26 69 28 33Z",
    baska:
      "M26 13 38 9 45 20 52 9 64 13 60 44 75 70Q58 80 45 71Q29 81 15 70L30 44Z",
    kostyum:
      "M22 15 36 9 45 20 54 9 68 15 83 47 68 53 61 37 63 66 47 68 45 28 43 68 27 66 29 37 22 53 7 47Z",
    korset: "M24 23Q34 13 45 24Q56 13 66 23L59 46 70 69 46 74 20 69 31 46Z",
    abaya:
      "M26 9 38 7 45 19 52 7 64 9 79 49 66 54 61 35 70 82 47 85 45 29 43 85 20 82 29 35 24 54 11 49Z",
  };
  return (
    <svg
      className={className}
      viewBox="0 0 90 94"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={paths[id]}
        fill="currentColor"
        fillOpacity=".13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d={
          id === "korset"
            ? "M32 27 36 65M45 27V68M58 27 54 65"
            : "M37 10 32 30 45 43 57 30 53 10M45 43V68"
        }
        stroke="currentColor"
        strokeWidth="1.3"
        strokeOpacity=".65"
      />
      {(id === "nimcha" || id === "abaya" || id === "baska") && (
        <path
          d="M28 47Q47 52 62 45L67 59M62 45 71 51"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
