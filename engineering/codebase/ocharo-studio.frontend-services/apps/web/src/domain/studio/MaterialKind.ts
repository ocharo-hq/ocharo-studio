export const MaterialKind = {
  Atlas: "atlas",
  Adras: "adras",
  Beqasam: "beqasam",
  Shoyi: "shoyi",
  Barbi: "barbi",
  SyntheticPoplin: "synthetic-poplin",
  SyntheticFabric: "synthetic-fabric",
  IndianScarf: "indian-scarf",
  Gobelen: "gobelen",
  Velvet: "velvet",
  Cotton: "cotton",
  Linen: "linen",
  Metallic: "metallic",
} as const;
export type MaterialKind = (typeof MaterialKind)[keyof typeof MaterialKind];
