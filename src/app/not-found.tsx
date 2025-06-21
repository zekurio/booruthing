import Link from "next/link";
import { Home } from "lucide-react";
import { Logo } from "~/components/logo";
import { Button } from "~/components/ui/button";

export default function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen px-4">
			<div className="flex flex-col items-center gap-8 text-center">
				<Logo />
				
				<div className="space-y-4">
					<h1 className="text-6xl font-bold text-muted-foreground font-mono">
						404
					</h1>
					<h2 className="text-2xl font-semibold">
						Page Not Found
					</h2>
					<p className="text-muted-foreground max-w-md">
						The page you're looking for doesn't exist or has been moved.
					</p>
				</div>

				<Button asChild className="gap-2">
					<Link href="/">
						<Home className="size-4" />
						Back to Home
					</Link>
				</Button>
			</div>
		</div>
	);
} 