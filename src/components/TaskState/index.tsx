import { CircleCheckBig, CircleSlash2, LoaderCircle } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useTranslation } from "react-i18next";

export type TaskStateType =
	| "all"
	| "done"
	| "reassigned"
	| "ongoing"
	| "pending"
	| "failed";

export interface TaskStateProps {
	all?: number;
	done: number;
	progress: number;
	skipped: number;
	reAssignTo?: number;
	failed?: number;
	selectedState?: TaskStateType;
	onStateChange?: (selectedState: TaskStateType) => void;
	clickable?: boolean;
}

export const TaskState = ({
	all,
	done,
	reAssignTo,
	progress,
	skipped,
	failed,
	selectedState = "all",
	onStateChange,
	clickable = true,
}: TaskStateProps) => {
	const chatStore = useChatStore();
	const { t } = useTranslation();
	const handleStateClick = (state: TaskStateType) => {
		if (!clickable || !onStateChange) return;
		onStateChange(state || "all");
	};

	const isSelected = (state: TaskStateType) => {
		return selectedState === state;
	};

	const fadeWidthClass = (selected: boolean) =>
		`inline-block overflow-hidden align-bottom transition-all duration-300 ease-in-out
     ${selected ? "max-w-[40px] opacity-100" : "max-w-0 opacity-0"}
     group-hover:max-w-[40px] group-hover:opacity-100`;

	return (
		<div>
			<div className="w-auto bg-transparent flex items-center gap-1 flex-wrap">
				{/* All */}
				{all && (
					<div
						className={`group hover:bg-tag-surface flex gap-xs items-center py-0.5 px-2 transition-all duration-200 ${
							isSelected("all") ? "bg-tag-surface" : "bg-transparent"
						} ${clickable ? "cursor-pointer" : ""}`}
						onClick={() => handleStateClick("all")}
					>
						<span className="text-xs font-normal text-text-body">
							{t("chat.all")}{" "}
							<span className={fadeWidthClass(isSelected("all"))}>{all}</span>
						</span>
					</div>
				)}

				{/* Done */}
				{done && done > 0 ? (
					<div
						className={`group hover:bg-tag-surface flex gap-xs items-center px-0.5 py-0.5 transition-all duration-200 ${
							isSelected("done") && "bg-tag-surface"
						} ${
							clickable && "cursor-pointer hover:opacity-80 transition-opacity"
						}`}
						onClick={() => handleStateClick("done")}
					>
						<CircleCheckBig
							className={`w-[10px] h-[10px] text-icon-secondary group-hover:text-icon-success ${
								isSelected("done") && "text-icon-success"
							}`}
						/>
						<span
							className={`transition-all duration-200 text-xs leading-tight font-normal text-text-label group-hover:text-text-success ${
								isSelected("done") && "text-text-success"
							}`}
						>
							{t("chat.done")}{" "}
							<span className={fadeWidthClass(isSelected("done"))}>{done}</span>
						</span>
					</div>
				) : null}

				{/* Reassigned */}
				{reAssignTo && reAssignTo > 0 ? (
					<div
						className={`group hover:bg-tag-surface flex gap-xs items-center px-0.5 py-0.5 transition-all duration-200 ${
							isSelected("reassigned") && "bg-tag-surface"
						} ${
							clickable && "cursor-pointer hover:opacity-80 transition-opacity"
						}`}
						onClick={() => handleStateClick("reassigned")}
					>
						<CircleSlash2
							className={`w-[10px] h-[10px] text-icon-secondary group-hover:text-icon-warning ${
								isSelected("reassigned") && "text-icon-warning"
							}`}
						/>
						<span
							className={`transition-all duration-200 text-xs leading-tight font-normal text-text-label group-hover:text-text-warning ${
								isSelected("reassigned") && "text-text-warning"
							}`}
						>
							{t("chat.reassigned")}{" "}
							<span className={fadeWidthClass(isSelected("reassigned"))}>
								{reAssignTo}
							</span>
						</span>
					</div>
				) : null}

				{/* Ongoing */}
				{progress && progress > 0 ? (
					<div
						className={`group hover:bg-tag-surface flex gap-xs items-center px-0.5 py-0.5 ${
							isSelected("ongoing") && "bg-tag-surface"
						} ${
							clickable && "cursor-pointer hover:opacity-80 transition-opacity"
						}`}
						onClick={() => handleStateClick("ongoing")}
					>
						<LoaderCircle
							className={`w-[10px] h-[10px] text-icon-secondary group-hover:text-icon-information ${
								isSelected("ongoing") && "!text-icon-information"
							} ${
								chatStore.tasks[chatStore.activeTaskId as string]?.status ===
									"running" && "animate-spin"
							}`}
						/>
						<span
							className={`transition-all duration-200 text-xs leading-tight font-normal text-text-label group-hover:text-text-information ${
								isSelected("ongoing") && "!text-text-information"
							}`}
						>
							{t("chat.ongoing")}{" "}
							<span className={fadeWidthClass(isSelected("ongoing"))}>
								{progress}
							</span>
						</span>
					</div>
				) : null}

				{/* Failed */}
				{failed && failed > 0 ? (
					<div
						className={`group hover:bg-tag-surface flex gap-xs items-center px-0.5 py-0.5 transition-all duration-200 ${
							isSelected("failed") && "bg-tag-surface"
						} ${
							clickable && "cursor-pointer hover:opacity-80 transition-opacity"
						}`}
						onClick={() => handleStateClick("failed")}
					>
						<CircleSlash2
							className={`w-[10px] h-[10px] text-icon-secondary group-hover:text-icon-cuation ${
								isSelected("failed") && "text-icon-cuation"
							}`}
						/>
						<span
							className={`transition-all duration-200 text-xs leading-tight font-normal text-text-label group-hover:text-text-cuatext-icon-cuation ${
								isSelected("failed") && "text-text-cuation"
							}`}
						>
							{t("chat.failed")}{" "}
							<span className={fadeWidthClass(isSelected("failed"))}>
								{failed}
							</span>
						</span>
					</div>
				) : null}
				{/* Pending */}
				{skipped && skipped > 0 ? (
					<div
						className={`group hover:bg-tag-surface flex gap-xs items-center px-0.5 py-0.5 ${
							isSelected("pending") ? "bg-tag-surface" : "bg-transparent"
						} ${
							clickable && "cursor-pointer hover:opacity-80 transition-opacity"
						}`}
						onClick={() => handleStateClick("pending")}
					>
						<LoaderCircle
							className={`w-[10px] h-[10px] text-icon-secondary group-hover:text-primary-foreground ${
								isSelected("pending") && "text-primary-foreground"
							}`}
						/>
						<span
							className={`text-xs leading-tight font-normal text-text-label group-hover:text-primary-foreground ${
								isSelected("pending") && "text-primary-foreground"
							}`}
						>
							{t("chat.pending")}{" "}
							<span className={fadeWidthClass(isSelected("pending"))}>
								{skipped}
							</span>
						</span>
					</div>
				) : null}
			</div>
		</div>
	);
};
