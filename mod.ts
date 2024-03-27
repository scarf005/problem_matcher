export type Pattern = {
	regexp: string
	loop?: boolean
	[key: string]: any
}

export type Matcher = {
	owner: string
	severity?: string
	pattern: Pattern[]
}

export default function (matcher: Matcher, input: string) {
	validateMatcher(matcher)

	if (matcher.pattern.length == 1) {
		return singleMatch(matcher, input)
	}

	const loopPattern = matcher.pattern[matcher.pattern.length - 1]
	if (loopPattern.loop) {
		return loopMatch(matcher, input)
	}

	throw new Error(
		"Unsupported pattern configuration. We currently support single pattern and multi-line loop pattern configurations",
	)
}

function loopMatch(matcher: Matcher, input: string) {
	const lines = input.split("\n")
	const matches = []

	// If we have context, try the loop line. If it matches, try it again
	// If not, reset context jump back to the first pattern
	while (lines.length) {
		let context = {}

		let line = lines.shift() as string

		// Take a copy that we can manipulate
		const patterns = matcher.pattern.slice(0)

		let x
		while ((x = patterns.shift())) {
			// Match the current line
			const re = new RegExp(x.regexp)

			const r = runRegExp(re, line, x, matcher)

			// If it's not a loop entry, save the matches in the context
			// and try processing the next pattern
			if (!x.loop) {
				context = { ...context, ...r }
				continue
			}

			while ((line = lines.shift() as string) !== undefined) {
				if (line === "") {
					continue
				}

				const r = runRegExp(re, line, x, matcher)

				// If the regexp didn't match, assume that the loop is over and start again
				if (!r) {
					lines.unshift(line)
					break
				}

				// Otherwise add a match and run this loop again
				matches.push({ ...context, ...r })
			}
		}
	}

	return matches
}

function singleMatch(matcher: Matcher, input: string) {
	// We only support single line matchers at the moment
	const pattern = matcher.pattern[0]
	const re = new RegExp(pattern.regexp)

	const lines = []

	for (const line of input.split("\n")) {
		const matches = runRegExp(re, line, pattern, matcher)
		if (!matches) {
			continue
		}

		lines.push(matches)
	}

	return lines
}

function validateMatcher(matcher: Matcher) {
	if (!Array.isArray(matcher.pattern) || matcher.pattern.length < 1) {
		throw new Error("matcher.pattern must be an array with at least one value")
	}
}


function runRegExp(re: RegExp, line: string, pattern: Pattern, matcher: Matcher) {
	const s = line.match(re)

	if (!s) {
		return null
	}

	const matches: Record<string, string> = {}
	for (const k in pattern) {
		if (k == "regexp" || k == "loop") {
			continue
		}

		if (pattern[k] === 0) {
			throw new Error(
				`Group 0 is not a valid capture group (it contains the entire matched string)`,
			)
		}

		if (!s[pattern[k]]) {
			throw new Error(
				`Invalid capture group provided. Group ${pattern[k]} (${k}) does not exist in regexp`,
			)
		}

		matches[k] = s[pattern[k]].trim()
	}

	if (!matches.severity) {
		matches.severity = matcher.severity
	}

	return matches
}
