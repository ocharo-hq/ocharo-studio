export interface MaterialScaleEntry {
  readonly scale: number;
  readonly revision: number;
  readonly updatedAt: string;
}
export type MaterialScaleLibrary = Readonly<Record<string, MaterialScaleEntry>>;
