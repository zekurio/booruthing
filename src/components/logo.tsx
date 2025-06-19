import { Shell } from "lucide-react";

export function Logo() {
	return (
		<div className="flex items-center gap-2 sm:gap-4 self-center font-bold">
			<div className="flex h-10 w-10 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
				<Shell className="size-6" />
			</div>
			<span className="text-3xl sm:text-6xl leading-none translate-y-[-1px]">
				booruthing.
			</span>
		</div>
	);
}
