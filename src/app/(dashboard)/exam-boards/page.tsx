import type { Metadata } from "next";
import { ExamBoardsView } from "@/features/exam-boards/exam-boards-view";
import { requireModule } from "@/lib/plan-guard";

export const metadata: Metadata = { title: "Exam Boards" };

export default async function ExamBoardsPage() {
  await requireModule("examBoards"); // Professional when billing gating is on
  return <ExamBoardsView />;
}
