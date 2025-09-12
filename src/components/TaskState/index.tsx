import { CircleCheckBig, CircleSlash2, LoaderCircle } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
export const TaskState = ({
	all,
	done,
	reAssignTo,
	progress,
	skipped,
}: {
	all: number;
	done: number;
	progress: number;
	skipped: number;
	reAssignTo: number;
}) => {
	const chatStore = useChatStore();
	return (
		<div>
			<div className="w-auto bg-transparent flex items-center gap-1 flex-wrap">
				{/* All */}
				<div className="flex gap-xs items-center py-0.5 px-2 bg-tag-surface">
					<span className="text-text-body text-xs font-normal ">
						All <span className="text-text-label">{all}</span>
					</span>
				</div>

				{/* Done */}
				<div
					className={`flex gap-xs items-center px-0.5 py-0.5 ${
						done > 0 ? "bg-tag-surface" : "bg-transparent"
					}`}
				>
					<CircleCheckBig
						className={`w-[10px] h-[10px] ${
							done>0 ? "text-icon-success" : "text-icon-secondary"
						}`}
					/>
					<span
						className={`text-text-body text-xs leading-tight font-normal ${
							done>0 ? "text-text-success" : "text-text-label"
						}`}
					>
						Done {done>0 ? done : ""}
					</span>
				</div>

				{/* Reassigned */}
				<div
					className={`flex gap-xs items-center px-0.5 py-0.5 ${
						reAssignTo>0 ? "bg-tag-surface" : "bg-transparent"
					}`}
				>
					<CircleSlash2
						className={`w-[10px] h-[10px] ${
							reAssignTo>0 ? "text-icon-warning" : "text-icon-secondary"
						}`}
					/>
					<span
						className={`text-text-body text-xs leading-tight font-normal ${
							reAssignTo>0 ? "text-text-warning" : "text-text-label"
						}`}
					>
						Reassigned {reAssignTo>0 ? reAssignTo : ""}
					</span>
				</div>

				{/* Ongoing */}
				<div
					className={`flex gap-xs items-center px-0.5 py-0.5 ${
						progress>0 ? "bg-tag-surface" : "bg-transparent"
					}`}
				>
					<LoaderCircle
						className={`w-[10px] h-[10px] ${
							progress>0 ? "text-icon-information" : "text-icon-secondary"
						}  ${
							chatStore.tasks[chatStore.activeTaskId as string].status ===
								"running" && "animate-spin"
						}`}
					/>
					<span
						className={` text-xs leading-tight font-normal ${
							progress>0 ? "text-text-information" : "text-text-label"
						}`}
					>
						Ongoing {progress>0 ? progress : ""}
					</span>
				</div>

				{/* Pending */}
				<div
					className={`flex gap-xs items-center px-0.5 py-0.5 ${
						skipped>0 ? "bg-tag-surface" : "bg-transparent"
					}`}
				>
					<LoaderCircle className={`w-[10px] h-[10px] text-icon-secondary`} />
					<span className="text-text-label text-xs leading-tight font-normal">
						Pending {skipped>0 ? skipped : ""}
					</span>
				</div>
			</div>
		</div>
	);
};
