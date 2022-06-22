export type ColumnType =
  | { type: "increments" }
  | { type: "json" }
  | { type: "boolean" }
  | { type: "decimal"; precision: [number, number] }
  | { type: "integer"; unsigned: boolean }
  | { type: "bigInteger"; unsigned: boolean }
  | { type: "float" }
  | { type: "date" }
  | { type: "dateTime" }
  | { type: "string"; length: number }
  | { type: "text" }
  | { type: "enum"; cases: Array<string> }
  | { type: "custom"; custom: string };

export type Column = {
  name: string;
  type: ColumnType;
  nullable: boolean;
  default: string | null
  onUpdate: string;
  comment: string;
};

export enum IndexType {
  Primary = "primary",
  Unique = "unique",
  Index = "index",
  FullText = "fulltext",
}
export const IndexTypeSort = {
  [IndexType.Primary]: 0,
  [IndexType.Unique]: 1,
  [IndexType.Index]: 2,
  [IndexType.FullText]: 3,
}

export type Index = {
  columns: Array<string>;
  type: IndexType;
};

export type ForeignKey = {
  columns: Array<string>;
  foreignTable: string;
  foreignColumns: Array<string>;
  onUpdate: string;
  onDelete: string;
};

export type Table = {
  name: string;
  columns: Array<Column>;
  indices: Array<Index>;
  foreignKeys: Array<ForeignKey>;
};
