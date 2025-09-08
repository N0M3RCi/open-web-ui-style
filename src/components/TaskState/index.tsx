import { CircleCheckBig, LoaderCircle } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useTranslation } from "react-i18next";
export const TaskState = ({	
	done,
	progress,
	skipped,
}: {
	done: number;
	progress: number;
	skipped: number;
}) => {
	const chatStore = useChatStore();
	const { t } = useTranslation();
	return (
		<div>
			<div className="w-auto bg-transparent flex items-center gap-1">
				<div className="flex gap-1 items-center py-0.5">
					<CircleCheckBig className="w-4 h-4 text-icon-primary" />
					<span className="text-text-body text-xs leading-tight font-normal">
						{done} {t("chat.done")}
					</span>
				</div>
				{progress !== 0 && (
					<div className="flex gap-1 items-center py-0.5">
						<LoaderCircle
							className={`w-4 h-4 text-icon-success ${
								chatStore.tasks[chatStore.activeTaskId as string].status ===
									"running" && "animate-spin"
							}`}
						/>
						<span className="text-text-success text-xs leading-tight font-normal">
							{progress} {t("chat.in-progress")}
						</span>
					</div>
				)}
				{skipped !== 0 && (
					<div className="flex gap-1 items-center py-0.5">
						<LoaderCircle
							className={`w-4 h-4 text-icon-secondary`}
						/>
						<span className="text-text-label text-xs leading-tight font-normal">
							{skipped} {t("chat.unfinished")}
						</span>
					</div>
				)}
			</div>
		</div>
	);
};
