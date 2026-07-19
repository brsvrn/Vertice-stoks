"use client";

export default function LabelGrid({
  children,
  columns = 2,
}) {
  return (
    <div
      className="label-sheet bg-white rounded-xl p-4 shadow-lg overflow-x-auto"
    >
      <div
        className="label-grid grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
