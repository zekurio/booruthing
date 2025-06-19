import { z } from "zod";

export const TagMode = z.enum(["include", "exclude"]);
export type TagMode = z.infer<typeof TagMode>;

export const AutocompleteResult = z.object({
	label: z.string(),
	value: z.string(),
	type: z.string().optional(),
});
export type AutocompleteResult = z.infer<typeof AutocompleteResult>;

export const TagWithMode = z.object({
	tag: z.string(),
	mode: TagMode,
	id: z.string(),
});
export type TagWithMode = z.infer<typeof TagWithMode>;

// More lenient schema to handle API variations
export const Post = z
	.object({
		id: z.number(),
		tags: z.string().optional().default(""),
		file_url: z.string(),
		preview_url: z.string(),
		sample_url: z.string().optional(),
		width: z.number(),
		height: z.number(),
		sample_width: z.number().optional(),
		sample_height: z.number().optional(),
		// Optional fields that may or may not be present
		directory: z.number().optional(),
		hash: z.string().optional(),
		image: z.string().optional(),
		change: z.number().optional(),
		owner: z.string().optional(),
		parent_id: z.number().optional(),
		rating: z.string().optional(),
		sample: z.boolean().optional(),
		score: z.number().optional(),
		source: z.string().optional(),
		status: z.string().optional(),
	})
	.passthrough(); // Allow additional fields we haven't defined

export type Post = z.infer<typeof Post>;

// API Response schema with better error handling
export const PostsApiResponse = z.union([
	z.array(Post),
	z
		.string()
		.length(0)
		.transform(() => []), // Empty string becomes empty array
	z
		.null()
		.transform(() => []), // Null becomes empty array
	z
		.undefined()
		.transform(() => []), // Undefined becomes empty array
]);
export type PostsApiResponse = z.infer<typeof PostsApiResponse>;
