/**
 * A repository's manifest: that it needs only its games and the SDK it was built on, and
 * that the packages it names are git repositories at a tag under names of their own.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { describe, expect, it } from "vitest";
import { checkManifest, packageSource, sharedPackages } from "./manifest.ts";

const least = { sdk: "^0.14.0", games: ["game-title"] };

describe("a repository's manifest", () => {
	it("needs its games and its SDK, and nothing of who the studio is", () => {
		expect(checkManifest("studio.json", least)).toEqual(least);
		expect(sharedPackages(checkManifest("studio.json", least))).toEqual({});
		expect(
			checkManifest("studio.json", {
				...least,
				id: "studio-name",
				name: "Studio Name"
			}).name
		).toBe("Studio Name");
	});

	it("names its packages as git repositories at a tag", () => {
		const packages = {
			"@studio-name/kit": "https://github.com/studio-name/kit.git#v1.2.0"
		};

		expect(
			sharedPackages(checkManifest("studio.json", { ...least, packages }))
		).toEqual(packages);
		expect(packageSource(packages["@studio-name/kit"])).toEqual({
			repository: "https://github.com/studio-name/kit.git",
			tag: "v1.2.0"
		});
	});

	it("refuses a package with no tag, an option for a repository, or a name that is taken", () => {
		for (const packages of [
			{ kit: "https://github.com/studio-name/kit.git" },
			{ kit: "--upload-pack=touch#v1" },
			{ "Kit!": "https://github.com/studio-name/kit.git#v1" },
			{ svelte: "https://github.com/studio-name/kit.git#v1" },
			{ "@rolarie/sdk": "https://github.com/studio-name/kit.git#v1" }
		])
			expect(() => checkManifest("studio.json", { ...least, packages })).toThrow();
	});
});
