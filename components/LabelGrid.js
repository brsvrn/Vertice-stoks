"use client";

export default function LabelGrid({
  children,
  columns = 2,
}) {
  return (
    <div
      className="
        bg-white
        rounded-xl
        p-6
        shadow-lg
        overflow-hidden
      "
    >
      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
