import type { Metadata } from "next";
import { ExamBoardsView } from "@/features/exam-boards/exam-boards-view";

export const metadata: Metadata = { title: "Exam Boards" };

export default function ExamBoardsPage() {
  return <ExamBoardsView />;
}
