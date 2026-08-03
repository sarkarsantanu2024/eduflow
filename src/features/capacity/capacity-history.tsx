"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { listMyCapacityHistory, type CapacityEventRow } from "@/features/capacity/actions";
import { describeEvent } from "@/features/capacity/capacity-admin-view";
import { formatDate } from "@/lib/utils";

/**
 * The centre's own capacity history. Answers "why do I have 250 seats?"
 * without them having to ask us.
 */
export function CapacityHistory() {
  const [rows, setRows] = useState<CapacityEventRow[]>([]);

  useEffect(() => {
    let alive = true;
    listMyCapacityHistory().then((r) => { if (alive) setRows(r); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (rows.length === 0) return null;

  return (
    <div>
      <h3 className="flex items-center gap-1.5 font-bold"><History className="size-4" /> Capacity history</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3 font-bold">Date</th>
              <th className="py-2 pr-3 font-bold">Action</th>
              <th className="py-2 pr-3 font-bold">By</th>
              <th className="py-2 font-bold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <td className="py-2 pr-3 whitespace-nowrap">{formatDate(e.createdAt)}</td>
                <td className="py-2 pr-3 font-medium">{describeEvent(e)}</td>
                <td className="py-2 pr-3 capitalize">{e.actor === "system" ? "System" : e.actorName || "Admin"}</td>
                <td className="py-2 text-muted-foreground">{e.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
