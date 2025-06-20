import { Shell } from "lucide-react";

export function Logo() {
	return (
		<div className="flex items-center gap-2 sm:gap-4 self-center font-bold">
			<div className="flex h-10 w-10 items-center justify-center rounded-none bg-primary text-primary-foreground">
				<Shell className="size-5" />
			</div>
			<span className="text-3xl font-mono leading-none translate-y-[-1px]">
				booruthing.
			</span>
		</div>
	);
}
