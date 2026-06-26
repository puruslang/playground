/**
 * CodeMirror 6 language mode for Purus.
 * Uses StreamLanguage (legacy-style parser) for simplicity.
 */
import { StreamLanguage } from '@codemirror/language';
import type { StreamParser } from '@codemirror/language';

// ---- token sets ----

const KEYWORDS = new Set([
	'const', 'let', 'var', 'be',
	'fn', 'return', 'to', 'gives', 'async', 'await', 'yield',
	'if', 'elif', 'else', 'unless', 'then',
	'while', 'until', 'do', 'for', 'in', 'range',
	'match', 'when', 'switch', 'case', 'default', 'blank',
	'try', 'catch', 'finally', 'throw',
	'import', 'from', 'export', 'require', 'use', 'namespace',
	'public', 'all', 'with', 'mod',
	'class', 'extends', 'super', 'static', 'private', 'protected',
	'get', 'set', 'new', 'delete', 'this',
	'typeof', 'instanceof', 'void', 'as', 'of', 'type',
	'break', 'continue', 'list', 'object', 'function', 'pipe',
]);

const OPERATORS = new Set([
	'add', 'sub', 'mul', 'div', 'fdiv', 'pow', 'neg',
	'eq', 'neq', 'lt', 'gt', 'le', 'ge',
	'and', 'or', 'not', 'coal',
	'band', 'bor', 'bxor', 'bnot', 'shl', 'shr', 'ushr',
]);

const ATOMS = new Set([
	'true', 'false', 'null', 'nil', 'undefined', 'nan', 'infinity',
]);

// ---- parser state ----
interface State {
	// inside ///.../// string
	inTripleString: boolean;
	// inside //;...;// string
	inSemiString: boolean;
	// inside ---...--- block comment
	inBlockComment: boolean;
}

// ---- Stream parser ----
const purusStreamParser: StreamParser<State> = {
	name: 'purus',

	startState(): State {
		return { inTripleString: false, inSemiString: false, inBlockComment: false };
	},

	token(stream, state): string | null {
		// ── Block comment ---...--- ──
		if (state.inBlockComment) {
			if (stream.match('---')) {
				state.inBlockComment = false;
				return 'comment';
			}
			stream.next();
			return 'comment';
		}

		// ── Triple-slash string ///.../// ──
		if (state.inTripleString) {
			if (stream.match('///')) {
				state.inTripleString = false;
				return 'string';
			}
			// Escape sequences
			if (stream.eat('\\')) { stream.next(); }
			else { stream.next(); }
			return 'string';
		}

		// ── Semicolon string //;...;// ──
		if (state.inSemiString) {
			if (stream.match(';//')) {
				state.inSemiString = false;
				return 'string';
			}
			if (stream.eat('\\')) { stream.next(); }
			else { stream.next(); }
			return 'string';
		}

		// ── Whitespace ──
		if (stream.eatSpace()) return null;

		// ── Block comment start --- ──
		if (stream.match('---')) {
			state.inBlockComment = true;
			stream.skipToEnd();
			return 'comment';
		}

		// ── Line comment -- ──
		if (stream.match('--')) {
			stream.skipToEnd();
			return 'comment';
		}

		// ── Triple-slash string start /// ──
		if (stream.match('///')) {
			state.inTripleString = true;
			return 'string';
		}

		// ── Semicolon string start //; ──
		if (stream.match('//;')) {
			state.inSemiString = true;
			return 'string';
		}

		// ── Regex /pattern/flags ──
		// Only if single / not followed by another /
		if (stream.peek() === '/') {
			const ch = stream.next(); // consume /
			let pattern = '';
			while (!stream.eol()) {
				const c = stream.peek();
				if (c === '\\') { stream.next(); stream.next(); continue; }
				if (c === '/') { stream.next(); break; }
				pattern += stream.next();
			}
			// consume optional flags
			stream.eatWhile(/[gimsuy]/);
			return 'string-2'; // regex
		}

		// ── Numbers: 0x, 0b, decimal, optional n suffix ──
		if (stream.match(/^0[xX][0-9a-fA-F]+n?/)) return 'number';
		if (stream.match(/^0[bB][01]+n?/)) return 'number';
		if (stream.match(/^-?[0-9]+(?:\.[0-9]+)?n?/)) return 'number';

		// ── Identifiers & keywords ──
		if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_\-]*/)) {
			const word = stream.current();
			if (KEYWORDS.has(word)) return 'keyword';
			if (OPERATORS.has(word)) return 'operator';
			if (ATOMS.has(word)) return 'atom';
			return 'variable';
		}

		// ── Punctuation ──
		if (stream.match(/^[[\].,;\\]/)) return 'punctuation';

		// ── Anything else ──
		stream.next();
		return null;
	},

	languageData: {
		commentTokens: { line: '--', block: { open: '---', close: '---' } },
		indentOnInput: /^\s*(else|elif|catch|finally)\b/
	}
};

export const purusLanguage = StreamLanguage.define(purusStreamParser);
