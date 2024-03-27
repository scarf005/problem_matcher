import { assertThrows } from "https://deno.land/std@0.220.1/assert/assert_throws.ts"
import { assertEquals } from "https://deno.land/std@0.220.1/assert/assert_equals.ts"
import matcher from "./mod.ts"

const validMatcher = {
	owner: "Deno.test-matcher",
	severity: "Error",
	pattern: [
		{
			regexp: "^([^:]+):([^:]+):([^:]+)$",
			message: 1,
			file: 2,
			line: 3,
		},
	],
}

const eslintSingleMatcher = {
	owner: "eslint-compact",
	pattern: [
		{
			regexp:
				"^(.+):\\sline\\s(\\d+),\\scol\\s(\\d+),\\s(Error|Warning|Info)\\s-\\s(.+)\\s\\((.+)\\)$",
			file: 1,
			line: 2,
			column: 3,
			severity: 4,
			message: 5,
			code: 6,
		},
	],
}

const eslintLoopMatcher = {
	owner: "eslint-stylish",
	pattern: [
		{
			// Matches the 1st line in the output
			regexp: "^([^\\s].*)$",
			file: 1,
		},
		{
			// Matches the 2nd and 3rd line in the output
			regexp: "^\\s+(\\d+):(\\d+)\\s+(error|warning|info)\\s+(.*)\\s\\s+(.*)$",
			// File is carried through from above, so we define the rest of the groups
			line: 1,
			column: 2,
			severity: 3,
			message: 4,
			code: 5,
			loop: true,
		},
	],
}

const loopMatcherWithDefaultSeverity = {
	owner: "Deno.test-matcher-loop",
	severity: "error",
	pattern: [
		{
			// Matches the 1st line in the output
			regexp: "^([^\\s].*)$",
			file: 1,
		},
		{
			// Matches the 2nd and 3rd line in the output
			regexp: "^\\s+(\\d+):(\\d+)\\s+\\s+(.*)\\s\\s+(.*)$",
			// File is carried through from above, so we define the rest of the groups
			line: 1,
			column: 2,
			message: 3,
			code: 4,
			loop: true,
		},
	],
}

Deno.test("throws an error if the matcher is missing", () => {
	const actual = () => matcher(undefined, "error::Something went wrong")
	assertThrows(actual, "No matcher provided")
})

Deno.test("throws an error if the matcher is invalid (no owner)", () => {
	const m = {
		pattern: [],
	}
	const actual = () => matcher(m, "error::Something went wrong")
	assertThrows(actual, "No matcher.owner provided")
})

Deno.test("throws an error if the matcher is invalid (no pattern)", () => {
	const m = {
		owner: "Deno.test",
	}
	const actual = () => matcher(m, "error::Something went wrong")
	assertThrows(actual, "No matcher.pattern provided")
})

Deno.test("throws an error if the matcher is invalid (empty pattern)", () => {
	const m = {
		owner: "Deno.test",
		pattern: [],
	}
	const actual = () => matcher(m, "error::Something went wrong")
	assertThrows(actual, "matcher.pattern must be an array with at least one value")
})

Deno.test("throws an error if the matcher is invalid (invalid pattern)", () => {
	const m = {
		owner: "Deno.test",
		pattern: { invalid: true },
	}
	const actual = () => matcher(m, "error::Something went wrong")
	assertThrows(actual, "matcher.pattern must be an array with at least one value")
})

Deno.test("throws an error if the input is missing", () => {
	const actual = () => matcher(validMatcher, undefined)
	assertThrows(actual, "No input provided")
})

Deno.test("single line matcher, no match", () => {
	const actual = matcher(eslintSingleMatcher, "this line won't match")
	assertEquals(actual, [])
})

Deno.test("single line matcher, does match", () => {
	const input =
		"badFile.js: line 50, col 11, Error - 'myVar' is defined but never used. (no-unused-vars)"
	const actual = matcher(eslintSingleMatcher, input)
	assertEquals(actual, [
		{
			file: "badFile.js",
			line: "50",
			column: "11",
			severity: "Error",
			message: "'myVar' is defined but never used.",
			code: "no-unused-vars",
		},
	])
})

Deno.test("loop line matcher, does match", () => {
	const input = `Deno.test.js
  1:0   error  Missing "use strict" statement                 strict
  5:10  error  'addOne' is defined but never used             no-unused-vars

foo.js
  36:10  error  Expected parentheses around arrow function argument  arrow-parens
  37:13  error  Expected parentheses around arrow function argument  arrow-parens

✖ 4 problems (4 errors, 0 warnings)`

	const actual = matcher(eslintLoopMatcher, input)
	assertEquals(actual, [
		{
			file: "Deno.test.js",
			line: "1",
			column: "0",
			severity: "error",
			message: 'Missing "use strict" statement',
			code: "strict",
		},
		{
			file: "Deno.test.js",
			line: "5",
			column: "10",
			severity: "error",
			message: "'addOne' is defined but never used",
			code: "no-unused-vars",
		},
		{
			file: "foo.js",
			line: "36",
			column: "10",
			severity: "error",
			message: "Expected parentheses around arrow function argument",
			code: "arrow-parens",
		},
		{
			file: "foo.js",
			line: "37",
			column: "13",
			severity: "error",
			message: "Expected parentheses around arrow function argument",
			code: "arrow-parens",
		},
	])
})

Deno.test("loop line matcher with default severity, does match", () => {
	const input = `Deno.test.js
  1:0   Missing "use strict" statement                 strict
  5:10  'addOne' is defined but never used             no-unused-vars

foo.js
  36:10  Expected parentheses around arrow function argument  arrow-parens
  37:13  Expected parentheses around arrow function argument  arrow-parens

✖ 4 problems (4 errors, 0 warnings)`

	const actual = matcher(loopMatcherWithDefaultSeverity, input)
	assertEquals(actual, [
		{
			file: "Deno.test.js",
			line: "1",
			column: "0",
			severity: "error",
			message: 'Missing "use strict" statement',
			code: "strict",
		},
		{
			file: "Deno.test.js",
			line: "5",
			column: "10",
			severity: "error",
			message: "'addOne' is defined but never used",
			code: "no-unused-vars",
		},
		{
			file: "foo.js",
			line: "36",
			column: "10",
			severity: "error",
			message: "Expected parentheses around arrow function argument",
			code: "arrow-parens",
		},
		{
			file: "foo.js",
			line: "37",
			column: "13",
			severity: "error",
			message: "Expected parentheses around arrow function argument",
			code: "arrow-parens",
		},
	])
})

Deno.test("uses default severity", () => {
	const input = "Some Message:/path/to/file.js:12"
	const actual = matcher(validMatcher, input)
	assertEquals(actual, [
		{
			file: "/path/to/file.js",
			line: "12",
			severity: "Error",
			message: "Some Message",
		},
	])
})

Deno.test("uses overridden severity", () => {
	const input = "Warning:Some Message:/path/to/file.js:12"
	const warningMatcher = {
		owner: "Deno.test-matcher",
		severity: "Error",
		pattern: [
			{
				regexp: "^([^:]+):([^:]+):([^:]+):([^:]+)$",
				severity: 1,
				message: 2,
				file: 3,
				line: 4,
			},
		],
	}
	const actual = matcher(warningMatcher, input)
	assertEquals(actual, [
		{
			file: "/path/to/file.js",
			line: "12",
			severity: "Warning",
			message: "Some Message",
		},
	])
})

Deno.test("pattern index provided that doesn't match a capture group", () => {
	const input = "Some Message:/path/to/file.js:12"
	const invalidOffsetMatcher = {
		owner: "Deno.test-matcher",
		pattern: [
			{
				regexp: "^([^:]+):([^:]+):([^:]+)$",
				message: 1,
				file: 2,
				line: 3,
				code: 4,
			},
		],
	}
	const actual = () => matcher(invalidOffsetMatcher, input)
	assertThrows(actual, "Invalid capture group provided. Group 4 (code) does not exist in regexp")
})

Deno.test("pattern index provided that matches group 0", () => {
	const input = "Some Message:/path/to/file.js:12"
	const invalidOffsetMatcher = {
		owner: "Deno.test-matcher",
		pattern: [
			{
				regexp: "^([^:]+):([^:]+):([^:]+)$",
				message: 0,
			},
		],
	}
	const actual = () => matcher(invalidOffsetMatcher, input)
	assertThrows(
		actual,
		`Group 0 is not a valid capture group (it contains the entire matched string)`,
	)
})

Deno.test("unsupported pattern configuration", () => {
	const multipleNoLoopMatcher = {
		owner: "Deno.test-matcher",
		pattern: [
			{
				regexp: "^([^:]+)",
				message: 1,
			},
			{
				regexp: '^([^"]+)',
				message: 1,
			},
		],
	}
	const actual = () => matcher(multipleNoLoopMatcher, "Test")
	assertThrows(
		actual,
		`Unsupported pattern configuration. We currently support single pattern and multi-line loop pattern configurations`,
	)
})
